import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "./auth.middleware";
import createHttpError from "http-errors";

import { UserModel } from "../modules/users";
import { Resource } from "../utils/resources";
import mongoose from "mongoose";

export const checkPermission = (resource: Resource, action: 'r' | 'w' | 'x') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user ID not found');
            }

            // Check basic permission
            if (!requestingUser.can(resource, action)) {
                throw createHttpError(403, 'Permission denied');
            }

            // If dealing with user-related operations
            if (resource === Resource.USERS && req.params.userId) {
                if (!mongoose.isValidObjectId(req.params.userId)) {
                    throw createHttpError(400, 'Invalid user ID format');
                }

                const targetUser = await UserModel.findById(req.params.userId).populate('role');
                if (!targetUser) {
                    throw createHttpError(404, 'User not found');
                }

                if (!requestingUser.role.descendants.includes(targetUser.role._id)) {
                    throw createHttpError(403, 'You cannot access users with this role level');
                }

                // Check if the requesting user is an ancestor of the target user
                if (!targetUser.path.includes(requestingUser._id.toString())) {
                    throw createHttpError(403, 'You are not authorized to perform this action');
                }
            }
            next()
        } catch (error) {
            next(error);
        }
    }
}