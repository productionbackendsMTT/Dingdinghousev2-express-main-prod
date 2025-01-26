import { Request, Response, NextFunction } from "express";
import RoleService from "./roles.service";
import mongoose from "mongoose";
import createHttpError from "http-errors";
import { successResponse } from "../../utils";
import { AuthRequest } from "../../middlewares";

class RoleController {
    constructor(private roleService: RoleService) {
        this.addRole = this.addRole.bind(this);
        this.updateRoleName = this.updateRoleName.bind(this);
        this.deleteRole = this.deleteRole.bind(this);
        this.getRoleById = this.getRoleById.bind(this);
        this.getAllRoles = this.getAllRoles.bind(this);
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

    async updateRoleName(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { name } = req.body;

            if (!mongoose.isValidObjectId(id)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            const role = await this.roleService.updateRoleName(id, name);
            res.status(200).json(successResponse(role, 'Role name updated successfully'));
        } catch (err) {
            next(err);
        }
    }

    async updateDescendants(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { descendantIds, operation } = req.body;

            if (!mongoose.isValidObjectId(id)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            const role = await this.roleService.updateDescendants(id, descendantIds, operation);
            res.status(200).json(successResponse(role, 'Role descendants updated successfully'));
        } catch (err) {
            next(err);
        }
    }


    async deleteRole(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            if (!mongoose.isValidObjectId(id)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            await this.roleService.deleteRole(id);
            res.status(200).json(successResponse(null, 'Role deleted successfully'));
        } catch (err) {
            next(err);
        }
    }

    async getRoleById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            if (!mongoose.isValidObjectId(id)) {
                throw createHttpError(400, 'Invalid role ID');
            }

            const role = await this.roleService.getRole(new mongoose.Types.ObjectId(id));
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