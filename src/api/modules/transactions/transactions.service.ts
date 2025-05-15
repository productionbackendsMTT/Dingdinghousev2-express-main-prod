import mongoose from "mongoose";
import createHttpError from "http-errors";
import Transaction from "../../../common/schemas/transaction.schema";
import { ITransaction, TransactionType } from "../../../common/types/transaction.type";
import User from "../../../common/schemas/user.schema";
import { UserStatus } from "../../../common/types/user.type";


class TransactionService {
    async create(senderId: mongoose.Types.ObjectId, receiverId: mongoose.Types.ObjectId, type: TransactionType, amount: number, session: mongoose.ClientSession): Promise<ITransaction> {
        if (amount <= 0) {
            throw createHttpError(400, "Transaction amount must be positive");
        }
        if (senderId.equals(receiverId)) {
            throw createHttpError(400, "Sender and receiver must be different");
        }

        // Validate sender and receiver
        const sender = await User.findOne({ _id: senderId, status: { $ne: UserStatus.DELETED } }).session(session);
        const receiver = await User.findOne({ _id: receiverId, status: { $ne: UserStatus.DELETED } }).session(session);

        if (!sender) {
            throw createHttpError(404, "Sender not found");
        }

        if (!receiver) {
            throw createHttpError(404, "Receiver not found");
        }

        // Check for sufficient balance in case of RECHARGE, unless sender is admin
        if (type === TransactionType.RECHARGE && sender.balance < amount) {
            throw createHttpError(400, "Insufficient balance for recharge");
        }

        // Check for sufficient balance in case of REDEEM
        if (type === TransactionType.REDEEM && receiver.balance < amount) {
            throw createHttpError(400, "Insufficient balance for redemption");
        }

        const transaction = new Transaction({
            sender: senderId,
            receiver: receiverId,
            type,
            amount
        });

        await transaction.save({ session });

        // Update sender and receiver balances based on transaction type
        if (type === TransactionType.RECHARGE) {
            sender.balance -= amount;
            receiver.balance += amount;
            sender.totalSpent += amount;
            receiver.totalReceived += amount;
        } else if (type === TransactionType.REDEEM) {
            sender.balance += amount;
            receiver.balance -= amount;
            sender.totalReceived += amount;
            receiver.totalSpent += amount;
        }

        // Save the updated user balances
        await sender.save({ session });
        await receiver.save({ session });

        return transaction;
    }

    // Get a transaction by ID
    async getById(transactionId: mongoose.Types.ObjectId): Promise<ITransaction | null> {
        const transaction = await Transaction.findById(transactionId)
            .populate({
                path: 'sender',
                select: 'name username balance role',
                match: { status: { $ne: UserStatus.DELETED } }
            })
            .populate({
                path: 'receiver',
                select: 'name username balance role',
                match: { status: { $ne: UserStatus.DELETED } }
            });

        if (transaction) {
            throw createHttpError(404, "Transaction not found");
        }
        return transaction;
    }

    // Get all transactions for a specific user
    async getByUser(userId: mongoose.Types.ObjectId, filters: any = {}, options: any = {}): Promise<{ data: ITransaction[], meta: { total: number, page: number, limit: number, pages: number } }> {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;

        const query = {
            $or: [{ sender: userId }, { receiver: userId }],
            ...filters
        };

        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                    path: 'sender',
                    select: 'name username balance role',
                    match: { status: { $ne: UserStatus.DELETED } }
                })
                .populate({
                    path: 'receiver',
                    select: 'name username balance role',
                    match: { status: { $ne: UserStatus.DELETED } }
                })
                .lean(),
            Transaction.countDocuments(query)
        ]);

        return {
            data: transactions as ITransaction[],
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // Get all transactions performed by a user's users
    async getByUsers(users: mongoose.Types.ObjectId[], startDate: Date, endDate: Date, options: any = {}): Promise<{
        data: ITransaction[],
        meta: { total: number; page: number; limit: number; pages: number; }
    }> {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const query = {
            $or: [
                { sender: { $in: users } },
                { receiver: { $in: users } }
            ],
            createdAt: { $gte: startDate, $lte: endDate }
        };

        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                    path: 'sender',
                    select: 'name username balance role',
                    match: { status: { $ne: UserStatus.DELETED } }
                })
                .populate({
                    path: 'receiver',
                    select: 'name username balance role',
                    match: { status: { $ne: UserStatus.DELETED } }
                })
                .lean(),
            Transaction.countDocuments(query)
        ]);

        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // Get total received and spent amounts for a user within a date range
    async getTotalAmounts(userId: mongoose.Types.ObjectId, startDate: Date, endDate: Date): Promise<{ totalReceived: number, totalSpent: number }> {
        const result = await Transaction.aggregate([
            {
                $match: {
                    $or: [
                        { sender: userId },
                        { receiver: userId }
                    ],
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalReceived: {
                        $sum: {
                            $cond: [{ $eq: ["$receiver", userId] }, "$amount", 0]
                        }
                    },
                    totalSpent: {
                        $sum: {
                            $cond: [{ $eq: ["$sender", userId] }, "$amount", 0]
                        }
                    }
                }
            }
        ]);

        return {
            totalReceived: result[0]?.totalReceived || 0,
            totalSpent: result[0]?.totalSpent || 0
        };
    }

    // Get all transactions
    async getAll(filters: any = {}, options: any = {}) {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;


        const [transactions, total] = await Promise.all([
            Transaction.find(filters)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                    path: 'sender',
                    select: 'name',
                })
                .populate({
                    path: 'receiver',
                    select: 'name',
                })
                .lean(),
            Transaction.countDocuments(filters)
        ]);

        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // Get all transactions for a user and their descendants using materialized path
    async getByUserAndDescendants(userId: mongoose.Types.ObjectId, filters: any = {}, options: any = {}): Promise<{
        data: ITransaction[],
        meta: { total: number; page: number; limit: number; pages: number; }
    }> {
        const { page = 1, limit = 10, sort = { createdAt: -1 } } = options;
        const searchTerm = filters.search;
        delete filters.search;


        const user = await User.findById(userId);
        if (!user) {
            throw createHttpError(404, "User not found");
        }

        const descendants = await user.getDescendants();
        const userIds = [user._id, ...descendants.map(descendant => descendant._id)];


        let query: any = {
            $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }],
            ...filters
        };

        if (searchTerm) {
            // First, find users matching the search term
            const matchingUsers = await User.find({
                $or: [
                    { name: new RegExp(searchTerm, "i") },
                    { username: new RegExp(searchTerm, "i") }
                ]
            }).select('_id');

            const userMatchIds = matchingUsers.map(user => user._id);

            // Update query to include user matches and other search criteria
            query = {
                $and: [
                    query,
                    {
                        $or: [
                            { type: new RegExp(searchTerm, "i") },
                            { amount: !isNaN(Number(searchTerm)) ? Number(searchTerm) : null },
                            { sender: { $in: userMatchIds } },
                            { receiver: { $in: userMatchIds } }
                        ].filter(condition =>
                            condition.amount !== null ||
                            Object.keys(condition).length > 0
                        )
                    }
                ]
            };
        }

        const [transactions, total] = await Promise.all([
            Transaction.find(query)
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({
                    path: 'sender',
                    select: 'name username balance role',
                    match: { status: { $ne: UserStatus.DELETED } }
                })
                .populate({
                    path: 'receiver',
                    select: 'name username balance role',
                    match: { status: { $ne: UserStatus.DELETED } }
                })
                .lean(),
            Transaction.countDocuments(query)
        ]);


        return {
            data: transactions,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

}

export default TransactionService;