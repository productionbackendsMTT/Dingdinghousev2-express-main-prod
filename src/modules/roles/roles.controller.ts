import { Request, Response, NextFunction } from "express";
import RoleService from "./roles.service";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { successResponse } from "../../utils";
import { AuthRequest } from "../../middlewares";
import { DescendantOperation } from "./roles.types";


class RoleController {
    constructor(private roleService: RoleService) {
        this.addRole = this.addRole.bind(this);
        this.deleteRole = this.deleteRole.bind(this);
        this.getRoleById = this.getRoleById.bind(this);
        this.getAllRoles = this.getAllRoles.bind(this);
        this.updateRole = this.updateRole.bind(this);
    }

    async addRole(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, descendants } = req.body;
            const role = await this.roleService.addRole(name, descendants || []);
            res.status(201).json(successResponse(role, 'Role created successfully'));
        } catch (err) {
            next(err);
        }
    }

    async updateRole(req: Request, res: Response, next: NextFunction) {
        try {
            const { roleId } = req.params;
            const { name, descendants, operation } = req.body;


            if (!mongoose.isValidObjectId(roleId)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            // Validate descendants if provided
            if (descendants !== undefined) {
                if (!operation) {
                    throw createHttpError.BadRequest('Operation is required when updating descendants');
                }

                if (!Object.values(DescendantOperation).includes(operation)) {
                    throw createHttpError(400, 'Invalid operation type');
                }

                if (!Array.isArray(descendants)) {
                    throw createHttpError(400, 'Descendants must be an array');
                }
            }

            const role = await this.roleService.updateRole(roleId, {
                name,
                descendants,
                operation: operation as DescendantOperation
            });

            res.status(200).json(successResponse(role, 'Role updated successfully'));

        } catch (error) {
            next(error);
        }
    }

    async deleteRole(req: Request, res: Response, next: NextFunction) {
        try {
            const { roleId } = req.params;
            if (!mongoose.isValidObjectId(roleId)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            await this.roleService.deleteRole(roleId);
            res.status(200).json(successResponse(null, 'Role deleted successfully'));
        } catch (err) {
            next(err);
        }
    }

    async getRoleById(req: Request, res: Response, next: NextFunction) {
        try {
            const { roleId } = req.params;

            if (!mongoose.isValidObjectId(roleId)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            const role = await this.roleService.getRole(new mongoose.Types.ObjectId(roleId));
            res.status(200).json(successResponse(role, 'Role retrieved successfully'));
        } catch (err) {
            next(err);
        }
    }

    async getAllRoles(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            const { page = 1, limit = 10, search } = req.query;
            const roles = await this.roleService.getAllRoles(
                Number(page),
                Number(limit),
                search as string,
                requestingUser.role._id
            );
            res.status(200).json(successResponse(roles, 'Roles retrieved successfully'));
        } catch (err) {
            next(err);
        }
    }
}

export default RoleController;