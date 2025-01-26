import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import UserService from "./users.service";
import { successResponse } from "../../utils";
import { AuthRequest } from "../../middlewares";
import mongoose from "mongoose";

class UserController {
    constructor(private userService: UserService) {
        this.deleteUser = this.deleteUser.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.getDescendants = this.getDescendants.bind(this);
        this.getDescendantsOfUser = this.getDescendantsOfUser.bind(this);
        this.updateUser = this.updateUser.bind(this);
        this.getUserById = this.getUserById.bind(this);
        this.getUserReport = this.getUserReport.bind(this);
        this.getUserPermissions = this.getUserPermissions.bind(this);
        this.updateUserPermissions = this.updateUserPermissions.bind(this);
    }

    async getCurrentUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }
            res.status(200).json(successResponse({
                _id: requestingUser._id,
                name: requestingUser.name,
                username: requestingUser.username,
                role: requestingUser.role,
                balance: requestingUser.balance,
                status: requestingUser.status,
                totalSpent: requestingUser.totalSpent,
                totalReceived: requestingUser.totalReceived,
                lastLogin: requestingUser.lastLogin,
                createdAt: requestingUser.createdAt,
                updatedAt: requestingUser.updatedAt
            },
                'User details retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserById(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { userId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            const user = await this.userService.getUserById(requestingUser._id, new mongoose.Types.ObjectId(userId));
            if (!user) {
                throw createHttpError(404, 'User not found');
            }

            res.status(200).json(successResponse(user, 'User retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getDescendantsOfUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { userId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            // Fetch the target user
            const targetUser = await this.userService.getUserById(requestingUser._id, new mongoose.Types.ObjectId(userId));
            if (!targetUser) {
                throw createHttpError(404, 'Target user not found');
            }


            const { page = 1, limit = 10, ...filters } = req.query;

            const { users, total } = await this.userService.getDescendants(
                new mongoose.Types.ObjectId(userId),
                filters,
                parseInt(page as string, 10),
                parseInt(limit as string, 10)
            );

            res.status(200).json(successResponse({ users, total, page, limit }, 'Descendants retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { userId } = req.params;
            const { balance, ...updateData } = req.body;

            const updatedUser = await this.userService.updateUser(
                requestingUser._id.toString(),
                new mongoose.Types.ObjectId(userId),
                { ...updateData, balance: balance?.amount },
                balance?.type
            );
            res.status(200).json(successResponse(updatedUser, 'User updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { userId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            await this.userService.deleteUser(requestingUser._id.toString(), userId);

            res.status(200).json(successResponse({}, 'User deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getDescendants(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { page = 1, limit = 10, ...filters } = req.query;
            const { users, total } = await this.userService.getDescendants(
                requestingUser._id,
                filters,
                parseInt(page as string, 10),
                parseInt(limit as string, 10)
            );

            res.status(200).json(successResponse({ users, total, page, limit }, 'Descendants retrieved successfully'));

        } catch (error) {
            next(error);
        }
    }

    async getUserReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { userId } = req.params;
            const { startDate, endDate } = req.query;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            const report = await this.userService.generateUserReport(
                requestingUser._id.toString(),
                new mongoose.Types.ObjectId(userId),
                new Date(startDate as string),
                new Date(endDate as string)
            );

            res.status(200).json(successResponse(report, 'User report generated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateUserPermissions(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { permissions, operation } = req.body;

            if (!mongoose.isValidObjectId(userId)) {
                throw createHttpError(400, 'Invalid user ID format');
            }

            if (!permissions || !Array.isArray(permissions) || !operation) {
                throw createHttpError(400, 'Invalid request format');
            }

            const updatedUser = await this.userService.updateUserPermissions(
                new mongoose.Types.ObjectId(userId),
                permissions,
                operation
            );

            res.status(200).json(successResponse(updatedUser, 'User permissions updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserPermissions(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { requestingUser } = req as AuthRequest;

            if (!mongoose.isValidObjectId(userId)) {
                throw createHttpError(400, 'Invalid user ID format');
            }

            const user = await this.userService.getUserById(
                requestingUser!._id,
                new mongoose.Types.ObjectId(userId)
            );

            res.status(200).json(successResponse(user?.permissions || [], 'User permissions retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

}

export default UserController;