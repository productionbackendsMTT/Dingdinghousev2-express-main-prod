import createHttpError from "http-errors";
import RoleModel from "./roles.model";
import mongoose, { Types } from "mongoose";
import { DescendantOperation, IRole, RoleStatus, IUpdateRoleParams } from "./roles.types";
import { UserModel } from "../users";
import { UserStatus } from "../users/users.types";
import { config } from "../../config/config";



class RoleService {

    async addRole(name: string, descendants: string[]): Promise<IRole> {
        const existingRole = await RoleModel.findOne({
            name,
            status: RoleStatus.ACTIVE
        });
        if (existingRole) {
            throw createHttpError(400, 'Role already exists');
        }

        const role = new RoleModel({ name, descendants });
        await role.save();

        return role;
    }

    async getRole(id: Types.ObjectId): Promise<IRole> {
        const role = await RoleModel.findOne({
            _id: id,
            status: RoleStatus.ACTIVE
        });

        if (!role) {
            throw createHttpError(404, 'Role not found');
        }

        return role;
    }

    async getAllRoles(page: number = 1, limit: number = 10, search?: string, requestingRoleId?: Types.ObjectId): Promise<{ roles: IRole[], total: number }> {
        const query: { status: RoleStatus; name?: RegExp, _id?: { $in: Types.ObjectId[] } } = {
            status: RoleStatus.ACTIVE
        };

        if (search) {
            query['name'] = new RegExp(search, 'i');
        }

        if (requestingRoleId) {
            const requestingRole = await RoleModel.findById(requestingRoleId);
            if (requestingRole) {
                query['_id'] = { $in: requestingRole.descendants };
            }
        }

        const total = await RoleModel.countDocuments(query);
        const roles = await RoleModel.find(query)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 });

        return { roles, total };
    }

    async validateRole(requestingRoleId: Types.ObjectId, targetRoleId: Types.ObjectId): Promise<void> {
        const requestingRole = await RoleModel.findOne({
            _id: requestingRoleId,
            status: RoleStatus.ACTIVE
        });

        if (!requestingRole) {
            throw createHttpError(404, 'Requesting role not found');
        }

        if (!requestingRole.descendants.includes(targetRoleId)) {
            throw createHttpError(403, 'Access denied: Role hierarchy violation');
        }
    }

    async updateRole(id: string, params: IUpdateRoleParams): Promise<IRole> {
        const role = await RoleModel.findById(id);
        if (!role) {
            throw createHttpError.NotFound('Role not found');
        }

        // Update name if provided
        if (params.name) {
            role.name = params.name;
        }

        // Update descendants if provided
        if (params.descendants && params.operation) {
            const descendantObjectIds = params.descendants.map(id => new Types.ObjectId(id));

            const count = await RoleModel.countDocuments({
                _id: { $in: descendantObjectIds },
                status: RoleStatus.ACTIVE
            });

            if (count !== params.descendants.length) {
                throw createHttpError.BadRequest('One or more descendant roles not found or inactive');
            }

            switch (params.operation) {
                case DescendantOperation.ADD:
                    // Convert existing descendants to strings for comparison
                    const existingDescendants = new Set(role.descendants.map(d => d.toString()));
                    // Add new descendants, ensuring uniqueness
                    descendantObjectIds.forEach(id => {
                        if (!existingDescendants.has(id.toString())) {
                            role.descendants.push(id);
                        }
                    });

                    break;
                case DescendantOperation.REMOVE:
                    // Convert descendants to remove to strings for comparison
                    const descendantsToRemove = new Set(descendantObjectIds.map(id => id.toString()));
                    // Filter out the descendants to remove
                    role.descendants = role.descendants.filter(d => !descendantsToRemove.has(d.toString()));
                    break;
                case DescendantOperation.REPLACE:
                    role.descendants = descendantObjectIds;
                    break;
            }
        }
        await role.save();
        return role;
    }

    async deleteRole(id: string): Promise<void> {
        const role = await RoleModel.findOne({
            _id: id,
            status: RoleStatus.ACTIVE
        });
        if (!role) {
            throw createHttpError(404, 'Active role not found');
        }

        if (role.name === config.root.role) {
            throw createHttpError.Forbidden('Cannot delete admin role');
        }

        // Check for users with this role
        // Check for active users with this role
        const activeUsersWithRole = await UserModel.countDocuments({
            role: role._id,
            status: UserStatus.ACTIVE
        });
        if (activeUsersWithRole > 0) {
            throw createHttpError.Conflict('Cannot delete role with existing active users');
        }

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                await RoleModel.findByIdAndUpdate(id, {
                    status: RoleStatus.DELETED,
                    name: `${role.name}_DELETED_${Date.now()}`  // Ensure unique name
                });

                await RoleModel.findOneAndUpdate(
                    { name: config.root.role },
                    { $pull: { descendants: role._id } }
                )

                // Remove from all other roles' descendants
                await RoleModel.updateMany(
                    { descendants: role._id },
                    { $pull: { descendants: role._id } }
                );
            });
        } finally {
            await session.endSession();
        }
    }
}

export default RoleService;