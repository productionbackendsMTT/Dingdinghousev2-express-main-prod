import createHttpError from "http-errors";
import UserModel from "./users.model";
import mongoose, { SortOrder } from "mongoose";
import TransactionModel, { TransactionType } from "../transactions/transactions.model";
import TransactionService from "../transactions/transactions.service";
import bcrypt from "bcrypt";
import { ITransformedUser, IUser, PermissionOperation, UserStatus } from "./users.types";
import { PERMISSION_PATTERN, Resource } from "../../utils/resources";
import RoleModel from "../roles/roles.model";
import GameModel from "../games/games.model";

class UserService {
    private transactionService: TransactionService;

    constructor() {
        this.transactionService = new TransactionService();
    }

    async getUserById(requestingUserId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<IUser | null> {
        const user = await UserModel.findById(userId).exec();
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        if (!this.isAncestor(requestingUserId.toString(), user)) {
            throw createHttpError(403, 'You are not authorized to perform this action');
        }

        return user;
    }

    isAncestor(requestingUserId: string, targetUser: IUser): boolean {
        return targetUser.path.includes(requestingUserId);
    }

    // Get all descendants of a user with pagination and filtering
    async getDescendants(userId: mongoose.Types.ObjectId, filters: any, page: number, limit: number) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        const { search, sort, view, role: roleName, from, to, ...otherFilters } = filters;

        // Get all role descendants that user has access to
        const role = await RoleModel.findById(user.role);
        if (!role) {
            throw createHttpError(404, 'Role not found');
        }

        const query: any = {
            path: { $regex: `^${user.path}` },
            _id: { $ne: userId },
            status: { $ne: UserStatus.DELETED },
            role: { $in: [...role.descendants, user.role] },  // Only get users with roles user has access to
            ...otherFilters
        };


        // Add date range filtering
        if (from || to) {
            query.createdAt = {};
            if (from) {
                query.createdAt.$gte = new Date(from);
            }
            if (to) {
                query.createdAt.$lte = new Date(to);
            }
        }

        if (roleName) {
            // Escape special regex characters
            const escapedRoleName = roleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const targetRole = await RoleModel.findOne({
                name: { $regex: new RegExp(escapedRoleName, 'i') }
            });

            if (targetRole) {
                query.role = targetRole._id;
            } else {
                throw createHttpError(404, `Role with name ${roleName} not found`);
            }
        }

        if (view === 'created') {
            query.createdBy = user._id;
        } else if (view === 'others') {
            query.createdBy = { $ne: user._id };
        }

        if (search) {
            try {
                // Escape special regex characters
                const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const searchRegex = new RegExp(escapedSearch, 'i');

                // Find roles matching search
                const matchingRoles = await RoleModel.find({
                    name: { $regex: searchRegex }
                }).select('_id');
                const roleIds = matchingRoles.map(r => r._id);

                // Find users by createdBy matching search
                const matchingCreators = await UserModel.find({
                    name: { $regex: searchRegex }
                }).select('_id');
                const creatorIds = matchingCreators.map(c => c._id);

                query.$or = [
                    { name: { $regex: searchRegex } },
                    { username: { $regex: searchRegex } },
                    { role: { $in: roleIds } },
                    { createdBy: { $in: creatorIds } }
                ];
            } catch (error) {
                throw createHttpError(400, 'Invalid search pattern');
            }
        }


        const total = await UserModel.countDocuments(query);

        let sortOption: { [key: string]: SortOrder } = { createdAt: -1 }; // Default sort by createdAt desc
        if (sort) {
            const [field, order] = sort.split(':');
            sortOption = { [field]: order === 'desc' ? -1 : 1 };
        }

        const users = await UserModel.find(query)
            .select('name username balance role status createdBy totalSpent totalReceived permissions lastLogin createdAt')
            .populate('role', 'name')
            .populate('createdBy', 'name')
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit);


        // const transformedUsers = users.map(user => ({
        //     _id: user._id,
        //     name: user.name,
        //     username: user.username,
        //     balance: user.balance,
        //     role: (user.role && typeof user.role !== 'string' && 'name' in user.role) ? user.role.name : null,
        //     status: user.status,
        //     createdBy: (user.createdBy && typeof user.createdBy !== 'string' && 'name' in user.createdBy) ? user.createdBy.name : null,
        //     totalSpent: user.totalSpent,
        //     totalReceived: user.totalReceived,
        //     lastLogin: user.lastLogin,
        //     createdAt: user.createdAt
        // }));

        // console.log(transformedUsers);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };

    }

    // Update a specific user
    async updateUser(requestingUserId: string, userId: mongoose.Types.ObjectId, updateData: Partial<IUser>, transactionType?: TransactionType): Promise<Partial<IUser>> {
        const allowedUpdates = ['name', 'username', 'password', 'balance', 'role', 'status', 'createdBy'];
        const updates = Object.keys(updateData);
        const disallowedUpdates = updates.filter(key => !allowedUpdates.includes(key));

        if (disallowedUpdates.length > 0) {
            throw createHttpError(400, `Disallowed fields: ${disallowedUpdates.join(', ')}`);
        }

        const updateObject: Partial<IUser> = {};
        updates.forEach(key => {
            if (key !== 'balance') {
                (updateObject as any)[key] = updateData[key as keyof IUser];
            }
        });

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw createHttpError(404, 'User not found');
            }

            if (!this.isAncestor(requestingUserId, user)) {
                throw createHttpError(403, 'You are not authorized to perform this action');
            }

            if (updateObject.password) {
                updateObject.password = await bcrypt.hash(updateObject.password, 10);
            }

            Object.assign(user, updateObject);
            await user.save({ session });

            if (updateData.balance) {
                if (!transactionType) {
                    throw createHttpError(400, 'Transaction type is required when updating balance');
                }
                if (!Object.values(TransactionType).includes(transactionType)) {
                    throw createHttpError(400, 'Invalid transaction type');
                }
                await this.transactionService.create(user.createdBy!, user._id, transactionType, updateData.balance, session);
            }

            await session.commitTransaction();
            session.endSession();

            // Fetch the updated user data to include the updated balance
            const updatedUser = await UserModel.findById(userId);

            // Construct the updated fields object to return
            const updatedFields: Partial<IUser> = {};
            updates.forEach(key => {
                (updatedFields as any)[key] = updatedUser![key as keyof IUser];
            });

            // Include balance in the updated fields if it was updated
            if (updateData.balance) {
                updatedFields.balance = updatedUser!.balance;
            }

            return updatedFields;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

    async deleteUser(targetUserId: string) {
        const session = await mongoose.startSession();
        try {
            return await session.withTransaction(async () => {
                // First get the current user to access their username
                const currentUser = await UserModel.findOne({
                    _id: targetUserId,
                    status: { $ne: UserStatus.DELETED }
                }).session(session);

                if (!currentUser) {
                    throw createHttpError(404, 'User not found or already deleted');
                }

                // Generate random hash for deleted user's password
                const deletedPassword = await bcrypt.hash(`DELETED_${Date.now()}`, 10);


                // Then update with the known username
                const user = await UserModel.findOneAndUpdate(
                    { _id: targetUserId },
                    {
                        $set: {
                            username: `${currentUser.username}_DELETED_${Date.now()}`,
                            status: UserStatus.DELETED,
                            token: undefined,
                            permissions: [],
                            password: deletedPassword
                        }
                    },
                    {
                        session,
                        new: true,
                        runValidators: true
                    }
                );

                if (!user) {
                    throw createHttpError(404, 'User not found');
                }

                const descendants = await UserModel.countDocuments({
                    path: { $regex: `^${user.path}/` },
                    status: { $ne: UserStatus.DELETED }
                });

                if (descendants > 0) {
                    throw createHttpError(400, 'Cannot delete user with descendants');
                }

                return user;
            });
        } finally {
            await session.endSession();
        }
    }

    async generateDescendantsReport(
        userId: mongoose.Types.ObjectId,
        from?: Date,
        to?: Date
    ): Promise<any> {
        // Default the date range to the last 7 days if not provided
        const currentDate = new Date();
        const defaultFrom = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const defaultTo = currentDate;

        const startDate = from || defaultFrom;
        const endDate = to || defaultTo;

        const requestingUser = await UserModel.findById(userId);
        if (!requestingUser) {
            throw createHttpError(404, 'User not found');
        }

        // Get descendant user IDs
        const descendants = await UserModel.find({
            path: { $regex: `^${requestingUser.path}/` },
            status: { $ne: UserStatus.DELETED },
        }).select('_id');

        const descendantIds = descendants.map(user => user._id);

        // Determine aggregation interval
        const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const groupFormat =
            totalDays <= 1
                ? { format: "%Y-%m-%dT%H:00:00Z", label: "hour" } // Hourly
                : totalDays <= 7
                    ? { format: "%Y-%m-%d", label: "day" } // Daily
                    : { format: "%Y-%U", label: "week" }; // Weekly

        // Aggregate user creations
        const userCreationSummary = await UserModel.aggregate([
            {
                $match: {
                    createdBy: { $in: descendantIds },
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: groupFormat.format, date: "$createdAt" } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Aggregate transactions
        const transactionSummary = await TransactionModel.aggregate([
            {
                $match: {
                    $or: [
                        { sender: { $in: descendantIds } },
                        { receiver: { $in: descendantIds } },
                    ],
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        period: { $dateToString: { format: groupFormat.format, date: "$createdAt" } },
                        type: "$type",
                        target: {
                            $cond: [{ $in: ["$sender", descendantIds] }, "sent", "received"],
                        },
                    },
                    totalAmount: { $sum: "$amount" },
                    count: { $sum: 1 },
                },
            },
            { $sort: { "_id.period": 1 } },
        ]);

        // Restructure transaction data for the frontend
        const transactionData: { [key: string]: any } = {};
        transactionSummary.forEach(item => {
            const period = item._id.period;
            const key = `${item._id.type}_${item._id.target}`;

            if (!transactionData[period]) {
                transactionData[period] = { period };
            }
            transactionData[period][key] = {
                count: item.count,
                totalAmount: item.totalAmount,
            };
        });

        return {
            timeRange: {
                from: startDate.toISOString(),
                to: endDate.toISOString(),
                duration: `${Math.round(totalDays)} days`,
            },
            userCreationSummary, // Aggregated user creation
            transactionSummary: Object.values(transactionData), // Aggregated transactions
            metrics: {
                totalCreatedUsers: userCreationSummary.reduce((sum, uc) => sum + uc.count, 0),
                totalRechargeReceived: transactionSummary
                    .filter(t => t._id.type === TransactionType.RECHARGE && t._id.target === "received")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
                totalRechargeSent: transactionSummary
                    .filter(t => t._id.type === TransactionType.RECHARGE && t._id.target === "sent")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
                totalRedeemDeducted: transactionSummary
                    .filter(t => t._id.type === TransactionType.REDEEM && t._id.target === "sent")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
                totalRedeemReceived: transactionSummary
                    .filter(t => t._id.type === TransactionType.REDEEM && t._id.target === "received")
                    .reduce((sum, t) => sum + t.totalAmount, 0),
            },
        };
    }

    // Generate report for a specific user
    async generateUserReport(
        userId: mongoose.Types.ObjectId,
        from?: Date,
        to?: Date
    ): Promise<any> {
        const currentDate = new Date();
        const defaultFrom = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const defaultTo = currentDate;

        const startDate = from || defaultFrom;
        const endDate = to || defaultTo;

        const user = await UserModel.findById(userId)
            .populate('createdBy', 'username')
            .populate('role', 'name');

        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        // Fetch users created by this user
        const createdUsers = await UserModel.aggregate([
            {
                $match: {
                    createdBy: userId,
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $project: {
                    _id: 1,
                    name: "$name",
                    username: "$username",
                    role: "$role",
                    timestamp: "$createdAt",
                },
            },
        ]);

        // Fetch transactions (recharge/redeem)
        const transactions = await TransactionModel.aggregate([
            {
                $match: {
                    $or: [{ sender: userId }, { receiver: userId }],
                    createdAt: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $project: {
                    _id: 1,
                    type: "$type",
                    timestamp: "$createdAt",
                    amount: "$amount",
                    target: {
                        $cond: [
                            { $eq: ["$sender", userId] },
                            "sent",
                            "received",
                        ],
                    },
                },
            },
        ]);

        // Group transactions by type
        const groupedTransactions = {
            recharge: transactions.filter((t) => t.type === TransactionType.RECHARGE),
            redeem: transactions.filter((t) => t.type === TransactionType.REDEEM),
        };

        // Calculate metrics
        const rechargeMetrics = {
            received: groupedTransactions.recharge
                .filter((t) => t.target === "received")
                .reduce((sum, t) => sum + t.amount, 0),
            sent: groupedTransactions.recharge
                .filter((t) => t.target === "sent")
                .reduce((sum, t) => sum + t.amount, 0),
        };

        const redeemMetrics = {
            deducted: groupedTransactions.redeem
                .filter((t) => t.target === "sent")
                .reduce((sum, t) => sum + t.amount, 0),
            received: groupedTransactions.redeem
                .filter((t) => t.target === "received")
                .reduce((sum, t) => sum + t.amount, 0),
        };

        const createdUsersCount = createdUsers.length;

        const userDetails = {
            _id: user._id,
            name: user.name,
            username: user.username,
            balance: user.balance,
            role: user.role,
            status: user.status,
            createdBy: user.createdBy && typeof user.createdBy !== 'string' ? ((user.createdBy as unknown) as IUser).username : null,
            lastLogin: user.lastLogin,
        };

        // Calculate duration
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const timeRange = {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
            duration: duration > 1 ? `${duration} days` : `${duration * 24} hours`,
        };

        return {
            timeRange,
            userDetails,
            createdUsers,
            transactions: groupedTransactions,
            metrics: {
                createdUsersCount,
                rechargeMetrics,
                redeemMetrics,
            },
        };
    }

    async updateUserPermissions(userId: mongoose.Types.ObjectId, permissions: { resource: Resource, permission: string }[], operation: PermissionOperation): Promise<IUser> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        permissions.forEach(newPermission => {
            const existingPermissionIndex = user.permissions.findIndex(p => p.resource === newPermission.resource);
            if (existingPermissionIndex !== -1) {
                // Update the existing permission
                const existingPermission = user.permissions[existingPermissionIndex].permission;
                let updatedPermission = '';

                for (let i = 0; i < 3; i++) {
                    const newChar = newPermission.permission[i];
                    const existingChar = existingPermission[i];
                    if (operation === PermissionOperation.ADD) {
                        // Add the new permission if it's not already present
                        updatedPermission += (newChar !== '-' && newChar !== existingChar) ? newChar : existingChar;
                    } else if (operation === PermissionOperation.REMOVE) {
                        // Remove the permission if it's present
                        updatedPermission += (newChar === existingChar) ? '-' : existingChar;
                    }
                }
                user.permissions[existingPermissionIndex].permission = updatedPermission;
            } else {
                // Add the new permission
                user.permissions.push(newPermission);
            }
        });
        await user.save();
        return user;
    }

    async getUserFavouriteGames(userId: mongoose.Types.ObjectId) {
        const user = await UserModel
            .findById(userId)
            .select('favouriteGames')
            .populate({
                path: 'favouriteGames',
                select: '-payout', // Exclude payout
            })
            .lean();

        return user?.favouriteGames || [];
    }

    async updateFavouriteGames(userId: mongoose.Types.ObjectId, gameId: mongoose.Types.ObjectId, action: 'add' | 'remove'): Promise<Partial<IUser>> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const user = await UserModel.findById(userId).session(session);
            if (!user) {
                throw createHttpError(404, 'User not found');
            }

            const game = await GameModel.findById(gameId).session(session);
            if (!game) {
                throw createHttpError(404, 'Game not found');
            }

            let updateQuery: any;
            if (action === 'add') {
                // Use $addToSet to add the game ID if it doesn't already exist
                updateQuery = { $addToSet: { favouriteGames: gameId } };
            } else if (action === 'remove') {
                // Use $pull to remove the game ID if it exists
                updateQuery = { $pull: { favouriteGames: gameId } };
            } else {
                throw createHttpError(400, 'Invalid action');
            }

            // Perform the update operation
            const updatedUser = await UserModel.findByIdAndUpdate(
                userId,
                updateQuery,
                { new: true, session } // Return the updated document
            );

            if (!updatedUser) {
                throw createHttpError(404, 'User not found after update');
            }


            await session.commitTransaction();
            session.endSession();

            return { favouriteGames: updatedUser.favouriteGames };

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}

export default UserService;