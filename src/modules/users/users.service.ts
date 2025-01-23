import createHttpError from "http-errors";
import UserModel, { IUser, UserStatus } from "./users.model";
import mongoose from "mongoose";

class UserService {

    // Get all descendants of a user with pagination and filtering
    async getDescendants(userId: mongoose.Types.ObjectId, filters: any, page: number, limit: number): Promise<{ users: IUser[], total: number }> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        const query = {
            path: { $regex: `^${user.path}` },
            _id: { $ne: userId },
            status: { $ne: UserStatus.DELETED },
            ...filters
        };

        const total = await UserModel.countDocuments(query);
        const users = await UserModel.find(query)
            .skip((page - 1) * limit)
            .limit(limit);

        return { users, total };

    }

    async delete(userId: string) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found')
        }

        await user.deleteOne();
    }
}

export default UserService;