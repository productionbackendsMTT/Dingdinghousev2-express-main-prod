import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import UserService from "./users.service";
import mongoose from "mongoose";
import { Resource } from "../../../common/lib/resources";
import { Roles } from "../../../common/lib/default-role-hierarchy";
import { successResponse } from "../../../common/lib/response";
import { AuthRequest } from "../../middleware/auth.middleware";


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
        this.getDescendantsReport = this.getDescendantsReport.bind(this);
    }

    async getCurrentUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const filteredPermissions =
                requestingUser.role?.name === Roles.PLAYER ? [] : requestingUser.permissions
                    .map(p => (p.resource === Resource.ROLES && p.permission !== 'rwx' ? null : p))
                    .filter(Boolean);

            const data = {
                _id: requestingUser._id,
                name: requestingUser.name,
                username: requestingUser.username,
                role: requestingUser.role,
                balance: requestingUser.balance,
                status: requestingUser.status,
                permissions: filteredPermissions
            };

            res.status(200).json(successResponse(data, 'User details retrieved successfully'));
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

            const {
                page = "1",
                limit = "10",
                from,
                to,
                sortBy = "createdAt",
                sortOrder = "desc",
                search = "",
                view,
                role,
                status,
                username,
            } = req.query;


            // Build filters object
            const queryFilters: any = {};

            // Add search filter
            if (search) {
                queryFilters.search = search;
            }

            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from) queryFilters.createdAt.$gte = new Date(from as string);
                if (to) queryFilters.createdAt.$lte = new Date(to as string);
            }

            // Add role filter
            if (role) {
                queryFilters.role = role;
            }

            // Add status filter
            if (status) {
                queryFilters.status = status;
            }

            // Add username filter
            if (username) {
                queryFilters.username = username;
            }

            // Add view filter
            if (view) {
                queryFilters.view = view;
            }

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10),
                sort: { [sortBy as string]: sortOrder === "desc" ? -1 : 1 },
            };

            const result = await this.userService.getDescendants(
                new mongoose.Types.ObjectId(userId),
                queryFilters,
                options
            );

            res.status(200).json(successResponse(result.data, 'Descendants retrieved successfully', result.meta));
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
            console.error(error);
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

            const deletedUser = await this.userService.deleteUser(userId);

            res.status(200).json(successResponse(deletedUser, `User deleted successfully`));
        } catch (error) {
            console.error(error);
            next(error);
        }
    }

    async getDescendants(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }
            const {
                page = "1",
                limit = "10",
                from,
                to,
                sortBy = "createdAt",
                sortOrder = "desc",
                search = "",
                view,
                role,
                status,
                username,
            } = req.query;

            // Build filters object
            const queryFilters: any = {};

            // Add search filter
            if (search) {
                queryFilters.search = search;
            }

            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from) queryFilters.createdAt.$gte = new Date(from as string);
                if (to) queryFilters.createdAt.$lte = new Date(to as string);
            }

            // Add role filter
            if (role) {
                queryFilters.role = role;
            }

            // Add status filter
            if (status) {
                queryFilters.status = status;
            }

            // Add username filter
            if (username) {
                console.log('username', username);
                queryFilters.username = username;
            }

            // Add view filter
            if (view) {
                queryFilters.view = view;
            }

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10),
                sort: { [sortBy as string]: sortOrder === "desc" ? -1 : 1 },
            };


            const result = await this.userService.getDescendants(
                requestingUser._id,
                queryFilters,
                options
            );

            res.status(200).json(successResponse(result.data, 'Descendants retrieved successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }

    async getDescendantsReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }
            const { from, to } = req.query;

            if (!mongoose.Types.ObjectId.isValid(requestingUser._id)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            const report = await this.userService.generateDescendantsReport(
                new mongoose.Types.ObjectId(requestingUser._id),
                from ? new Date(from as string) : undefined,
                to ? new Date(to as string) : undefined
            );

            res.status(200).json({
                success: true,
                message: "Descendants report generated successfully",
                data: report,
            });
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
            const { from, to } = req.query;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            // Parse the query parameters if they are provided
            const fromDate = from ? new Date(from as string) : undefined;
            const toDate = to ? new Date(to as string) : undefined;

            const report = await this.userService.generateUserReport(
                new mongoose.Types.ObjectId(userId),
                fromDate,
                toDate
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

    async getUserFavouriteGames(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            const favouriteGames = await this.userService.getUserFavouriteGames(
                new mongoose.Types.ObjectId(userId)
            );

            res.status(200).json(successResponse(favouriteGames, 'Favourite games retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateFavouriteGames(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user not found');
            }

            const { userId } = req.params;
            const { game, action } = req.body; // `action` can be 'add' or 'remove'

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw createHttpError(400, 'Invalid user ID');
            }

            if (!game || typeof game !== 'string') {
                throw createHttpError(400, 'Game must be a valid string');
            }

            if (!['add', 'remove'].includes(action)) {
                throw createHttpError(400, 'Action must be either "add" or "remove"');
            }

            const updatedUser = await this.userService.updateFavouriteGames(
                new mongoose.Types.ObjectId(userId),
                new mongoose.Types.ObjectId(game),
                action
            );

            res.status(200).json(successResponse(updatedUser, 'Favourite games updated successfully'));
        } catch (error) {
            next(error);
        }
    }

}

export default UserController;