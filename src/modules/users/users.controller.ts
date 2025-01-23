import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import UserService from "./users.service";
import { successResponse } from "../../utils";
import { AuthRequest } from "../../middlewares";

class UserController {
    constructor(private userService: UserService) {
        this.delete = this.delete.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.getDescendants = this.getDescendants.bind(this);
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

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            if (!userId) {
                throw createHttpError(400, 'User ID is required');
            }

            await this.userService.delete(userId);

            res.status(200).json(successResponse({}, 'User deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

}

export default UserController;