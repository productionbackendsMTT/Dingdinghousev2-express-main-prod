import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import mongoose from "mongoose";
import { AuthRequest } from "./auth.middleware";
import { Resource } from "../lib/resources";
import RoleModel from "../../api/modules/roles/roles.model";
import UserModel from "../../api/modules/users/users.model";

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
            if ((resource === Resource.USERS || resource === Resource.TRANSACTIONS) && req.params.userId) {
                if (!mongoose.isValidObjectId(req.params.userId)) {
                    throw createHttpError(400, 'Invalid user ID format');
                }

                // Allow if user is accessing their own data
                if (req.params.userId === requestingUser._id.toString()) {
                    return next();
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

            // If dealing with role-related operations
            if (resource === Resource.ROLES && req.params.roleId) {
                if (!mongoose.isValidObjectId(req.params.roleId)) {
                    throw createHttpError(400, 'Invalid role ID format');
                }

                // Allow if user is accessing their own role
                if (req.params.roleId === requestingUser.role._id.toString()) {
                    return next();
                }

                const targetRole = await RoleModel.findById(req.params.roleId).lean();
                if (!targetRole) {
                    throw createHttpError(404, 'Role not found');
                }

                // Check if requesting user's role has the target role in its descendants
                if (!requestingUser.role.descendants.includes(targetRole._id)) {
                    throw createHttpError(403, 'You cannot access roles with this level');
                }
            }
            next()
        } catch (error) {
            next(error);
        }
    }
}