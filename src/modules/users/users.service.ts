import createHttpError from "http-errors";
import UserModel from "./users.model";
import mongoose, { SortOrder } from "mongoose";
import TransactionModel, { TransactionType } from "../transactions/transactions.model";
import TransactionService from "../transactions/transactions.service";
import bcrypt from "bcrypt";
import { IUser, PermissionOperation, UserStatus } from "./users.types";
import RoleModel from "../roles/roles.model";
import { PERMISSION_PATTERN, Resource } from "../../utils/resources";

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
        user.status = UserStatus.DELETED;
        await user.save();
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

        // Normalize and validate permissions
        const normalizedPermissions = permissions.map(perm => ({
            resource: perm.resource,
            permission: perm.permission.padEnd(3, '-')  // Pad with dashes: 'rw' -> 'rw-'
        }));

        // Validate permissions format
        for (const perm of normalizedPermissions) {
            if (perm.permission.length > 3 || !PERMISSION_PATTERN.test(perm.permission)) {
                throw createHttpError(400, 'Invalid permission format. Must contain only r,w,x or - characters, max length 3');
            }
        }

        switch (operation) {
            case PermissionOperation.ADD:
                for (const newPerm of normalizedPermissions) {
                    const existingIndex = user.permissions.findIndex(p => p.resource === newPerm.resource);
                    if (existingIndex === -1) {
                        user.permissions.push(newPerm);
                    }
                }
                break;

            case PermissionOperation.REMOVE:
                user.permissions = user.permissions.filter(existing =>
                    !permissions.some(p => p.resource === existing.resource)
                );
                break;

            case PermissionOperation.REPLACE:
                user.permissions = normalizedPermissions;
                break;
        }

        await user.save();
        return user;
    }
}

export default UserService;