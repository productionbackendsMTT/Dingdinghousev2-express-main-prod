import createHttpError from "http-errors";
import mongoose, { Types } from "mongoose";
import { config } from "../../../common/config/config";
import { Roles } from "../../../common/lib/default-role-hierarchy";
import Role from "../../../common/schemas/role.schema";
import { DescendantOperation, IRole, IUpdateRoleParams, RoleStatus } from "../../../common/types/role.type";
import User from "../../../common/schemas/user.schema";
import { UserStatus } from "../../../common/types/user.type";

class RoleService {

    async addRole(name: string, descendants: string[]): Promise<IRole> {
        const existingRole = await Role.findOne({
            name: { $regex: new RegExp(`^${name}$`, "i") },
            status: RoleStatus.ACTIVE,
        });
        if (existingRole) {
            throw createHttpError(400, "Role already exists");
        }

        const role = new Role({ name, descendants });
        await role.save();

        return role;
    }

    async getRole(id: Types.ObjectId): Promise<IRole> {
        const role = await Role.findOne({
            _id: id,
            status: { $ne: RoleStatus.DELETED },
        }).populate({
            path: "descendants",
            select: "name status",
            match: { status: RoleStatus.ACTIVE },
        });

        if (!role) {
            throw createHttpError(404, "Role not found");
        }

        return role;
    }

    async getAllRoles(
        filters: any = {},
        options: any = {}
    ): Promise<{
        data: IRole[];
        meta: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }> {
        const {
            page = 1,
            limit = 10,
            search,
            sortBy = "createdAt",
            sortOrder = "desc",
            requestingRoleId,
        } = options;

        const query: {
            status: RoleStatus;
            name?: RegExp;
            _id?: { $in: Types.ObjectId[] };
        } = {
            status: { $ne: RoleStatus.DELETED },
            ...filters,
        };

        // Add search filter
        if (search) {
            query["name"] = new RegExp(search, "i");
        }

        // Add role hierarchy filter
        if (requestingRoleId) {
            const requestingRole = await Role.findById(requestingRoleId);
            if (requestingRole) {
                query["_id"] = { $in: [...requestingRole.descendants] };
            }
        }

        const [roles, total] = await Promise.all([
            Role.find(query)
                .select("_id name status") // Only select required fields
                .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Role.countDocuments(query),
        ]);

        return {
            data: roles,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }


    async validateRole(
        requestingRoleId: Types.ObjectId,
        targetRoleId: Types.ObjectId
    ): Promise<void> {
        const requestingRole = await Role.findOne({
            _id: requestingRoleId,
            status: RoleStatus.ACTIVE,
        });

        if (!requestingRole) {
            throw createHttpError(404, "Requesting role not found");
        }

        if (!requestingRole.descendants.includes(targetRoleId)) {
            throw createHttpError(403, "Access denied: Role hierarchy violation");
        }
    }

    async updateRole(id: string, params: IUpdateRoleParams): Promise<IRole> {
        const role = await Role.findById(id);
        if (!role) {
            throw createHttpError.NotFound("Role not found");
        }

        // Update name if provided
        if (params.name) {
            role.name = params.name;
        }

        // Update status if provided
        if (params.status) {
            role.status = params.status;
        }

        // Update descendants if provided
        if (params.descendants && params.operation) {
            const descendantObjectIds = params.descendants.map(
                (id) => new Types.ObjectId(id)
            );

            const count = await Role.countDocuments({
                _id: { $in: descendantObjectIds },
                status: { $ne: RoleStatus.DELETED },
            });

            if (count !== params.descendants.length) {
                throw createHttpError.BadRequest(
                    "One or more descendant roles not found or inactive"
                );
            }

            switch (params.operation) {
                case DescendantOperation.ADD:
                    // Convert existing descendants to strings for comparison
                    const existingDescendants = new Set(
                        role.descendants.map((d) => d.toString())
                    );
                    // Add new descendants, ensuring uniqueness
                    descendantObjectIds.forEach((id) => {
                        if (!existingDescendants.has(id.toString())) {
                            role.descendants.push(id);
                        }
                    });

                    break;
                case DescendantOperation.REMOVE:
                    // Convert descendants to remove to strings for comparison
                    const descendantsToRemove = new Set(
                        descendantObjectIds.map((id) => id.toString())
                    );
                    // Filter out the descendants to remove
                    role.descendants = role.descendants.filter(
                        (d) => !descendantsToRemove.has(d.toString())
                    );
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
        const role = await Role.findOne({
            _id: id,
            status: { $ne: RoleStatus.DELETED },
        });
        if (!role) {
            throw createHttpError(404, "Active role not found");
        }

        // Check if the role is a root role or a system role
        if (
            role.name === config.root.role ||
            role.name === Roles.ADMIN ||
            role.name === Roles.PLAYER
        ) {
            throw createHttpError.Forbidden("Cannot delete this role");
        }

        // Check for users with this role
        // Check for active users with this role
        const activeUsersWithRole = await User.countDocuments({
            role: role._id,
            status: UserStatus.ACTIVE,
        });
        if (activeUsersWithRole > 0) {
            throw createHttpError.Conflict(
                "Cannot delete role with existing active users"
            );
        }

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                await Role.findByIdAndUpdate(id, {
                    status: RoleStatus.DELETED,
                    name: `${role.name}_DELETED_${Date.now()}`, // Ensure unique name
                });

                await Role.findOneAndUpdate(
                    { name: config.root.role },
                    { $pull: { descendants: role._id } }
                );

                // Remove from all other roles' descendants
                await Role.updateMany(
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