import createHttpError from "http-errors";
import RoleModel, { ADMIN_ROLE_ID, IRole, RoleStatus } from "./roles.model";
import mongoose, { Types } from "mongoose";

enum DescendantOperation {
    ADD = 'add',
    REMOVE = 'remove',
    REPLACE = 'replace'
}

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

        // Update admin's descendants
        await RoleModel.findByIdAndUpdate(
            ADMIN_ROLE_ID,
            { $addToSet: { descendants: role._id } }
        );

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

    async updateRoleName(id: string, name: string): Promise<IRole | null> {
        if (id === ADMIN_ROLE_ID.toString()) {
            throw createHttpError(403, 'Admin role cannot be modified');
        }

        const role = await RoleModel.findByIdAndUpdate(id, { name }, { new: true });
        if (!role) {
            throw createHttpError(404, 'Role not found');
        }
        return role;
    }

    async updateDescendants(roleId: string, descendantIds: string[], operation: DescendantOperation): Promise<IRole> {
        if (roleId === ADMIN_ROLE_ID.toString()) {
            throw createHttpError(403, 'Admin role cannot be modified');
        }

        const descendantObjectIds = descendantIds.map(id => new Types.ObjectId(id));

        const count = await RoleModel.countDocuments({
            _id: { $in: descendantObjectIds },
            status: RoleStatus.ACTIVE
        });

        if (count !== descendantIds.length) {
            throw createHttpError(400, 'One or more descendant roles not found or inactive');
        }

        let updateQuery;
        switch (operation) {
            case DescendantOperation.ADD:
                updateQuery = {
                    $addToSet: { descendants: { $each: descendantObjectIds } }
                };
                break;
            case DescendantOperation.REMOVE:
                updateQuery = {
                    $pull: { descendants: { $in: descendantObjectIds } }
                };
                break;
            case DescendantOperation.REPLACE:
                updateQuery = {
                    $set: { descendants: descendantObjectIds }
                };
                break;
        }

        const role = await RoleModel.findOneAndUpdate(
            { _id: roleId, status: RoleStatus.ACTIVE },
            updateQuery,
            { new: true }
        );

        if (!role) {
            throw createHttpError(404, 'Role not found');
        }

        return role;
    }

    async deleteRole(id: string): Promise<void> {
        if (id === ADMIN_ROLE_ID.toString()) {
            throw createHttpError(403, 'Admin role cannot be deleted');
        }

        const role = await RoleModel.findById(id);
        if (!role) {
            throw createHttpError(404, 'Role not found');
        }

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                // Soft delete the role
                await RoleModel.findByIdAndUpdate(id, {
                    status: RoleStatus.DELETED,
                    name: `${role.name}_DELETED_${Date.now()}`  // Ensure unique name
                });

                // Remove from admin's descendants
                await RoleModel.findByIdAndUpdate(
                    ADMIN_ROLE_ID,
                    { $pull: { descendants: role._id } }
                );

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