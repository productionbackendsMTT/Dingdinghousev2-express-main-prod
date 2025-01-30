import createHttpError from "http-errors";
import UserModel from "./users.model";
import mongoose, { SortOrder } from "mongoose";
import TransactionModel, { TransactionType } from "../transactions/transactions.model";
import TransactionService from "../transactions/transactions.service";
import bcrypt from "bcrypt";
import { IUser, PermissionOperation, UserStatus } from "./users.types";
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
    async getDescendants(userId: mongoose.Types.ObjectId, filters: any, page: number, limit: number): Promise<{ users: IUser[], total: number }> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        const { search, sort, ...otherFilters } = filters;

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

        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Case-insensitive regex

            query.$or = [
                { name: { $regex: searchRegex } },
                { username: { $regex: searchRegex } }
            ];
        }

        const total = await UserModel.countDocuments(query);

        let sortOption: { [key: string]: SortOrder } = {};
        if (sort) {
            const [field, order] = sort.split(':');
            sortOption[field] = order === 'desc' ? -1 : 1;
        }
        const users = await UserModel.find(query)
            .sort(sortOption)
            .skip((page - 1) * limit)
            .limit(limit);

        return { users, total };

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

    async deleteUser(requestingUserId: string, targetUserId: string) {
        const user = await UserModel.findById(targetUserId);
        if (!user) {
            throw createHttpError(404, 'User not found')
        }

        if (!this.isAncestor(requestingUserId, user)) {
            throw createHttpError(403, 'You are not authorized to perform this action');
        }

        const descendants = await user.getDescendants();
        if (descendants.length > 0) {
            throw createHttpError(400, 'Cannot delete user with descendants');
        }

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                // Modify username to allow reuse
                user.username = `${user.username}_DELETED_${Date.now()}`;
                user.status = UserStatus.DELETED;

                // Clear sensitive data
                user.token = undefined;
                user.permissions = [];

                await user.save({ session });
            });
        } catch (error) {
            throw error; // Let the error propagate
        } finally {
            await session.endSession();
        }
    }

    // Generate report for a specific user
    async generateUserReport(requestingUserId: string, userId: mongoose.Types.ObjectId, startDate: Date, endDate: Date): Promise<any> {
        const user = await UserModel.findById(userId).populate('createdBy', 'username');
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        if (!this.isAncestor(requestingUserId, user)) {
            throw createHttpError(403, 'You are not authorized to perform this action');
        }

        // Get all users created by this user
        const createdUsers = await UserModel.find({
            createdBy: userId,
            createdAt: { $gte: startDate, $lte: endDate }
        });


        // Get all transactions performed by this user's users
        const transactions = await this.transactionService.getByUsers(createdUsers.map(u => u._id), startDate, endDate);

        // Calculate total amount received and spent
        const { totalReceived, totalSpent } = await this.transactionService.getTotalAmounts(userId, startDate, endDate);

        const userDetails = {
            _id: user._id,
            name: user.name,
            username: user.username,
            balance: user.balance,
            role: user.role,
            status: user.status,
            createdBy: user.createdBy && typeof user.createdBy !== 'string' ? ((user.createdBy as unknown) as IUser).username : null,
            lastLogin: user.lastLogin
        };

        return {
            ...userDetails,
            createdUsers,
            transactions,
            totalReceived,
            totalSpent
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