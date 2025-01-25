import mongoose from "mongoose";
import TransactionModel, { ITransaction, TransactionType } from "./transactions.model";
import { UserModel } from "../users";
import createHttpError from "http-errors";
import { UserStatus } from "../users/users.types";


class TransactionService {
    async create(senderId: mongoose.Types.ObjectId, receiverId: mongoose.Types.ObjectId, type: TransactionType, amount: number, session: mongoose.ClientSession): Promise<ITransaction> {
        if (amount <= 0) {
            throw createHttpError(400, "Transaction amount must be positive");
        }
        if (senderId.equals(receiverId)) {
            throw createHttpError(400, "Sender and receiver must be different");
        }

        // Validate sender and receiver
        const sender = await UserModel.findOne({ _id: senderId, status: { $ne: UserStatus.DELETED } }).session(session);
        const receiver = await UserModel.findOne({ _id: receiverId, status: { $ne: UserStatus.DELETED } }).session(session);

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

        const transaction = new TransactionModel({
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
        const transaction = await TransactionModel.findById(transactionId)
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
    async getByUser(userId: mongoose.Types.ObjectId): Promise<ITransaction[]> {
        const transactions = await TransactionModel.find({
            $or: [{ sender: userId }, { receiver: userId }]
        })
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

        return transactions;
    }

    // Get all transactions performed by a user's users
    async getByUsers(users: mongoose.Types.ObjectId[], startDate: Date, endDate: Date): Promise<ITransaction[]> {
        const transactions = await TransactionModel.find({
            $or: [
                { sender: { $in: users } },
                { receiver: { $in: users } }
            ],
            createdAt: { $gte: startDate, $lte: endDate }
        });

        return transactions;
    }

    // Get total received and spent amounts for a user within a date range
    async getTotalAmounts(userId: mongoose.Types.ObjectId, startDate: Date, endDate: Date): Promise<{ totalReceived: number, totalSpent: number }> {
        const result = await TransactionModel.aggregate([
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
    async getAll(): Promise<ITransaction[]> {
        const transactions = await TransactionModel.find()
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
        return transactions;
    }

    // Get all transactions for a user and their descendants using materialized path
    async getByUserAndDescendants(userId: mongoose.Types.ObjectId): Promise<ITransaction[]> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, "User not found");
        }

        const descendants = await user.getDescendants();
        const userIds = [user._id, ...descendants.map(descendant => descendant._id)];

        const transactions = await TransactionModel.find({
            $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }]
        })
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

        return transactions;
    }

}

export default TransactionService;