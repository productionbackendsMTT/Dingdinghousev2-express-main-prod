import mongoose, { Model, Schema, Types } from "mongoose";
import { IRole, IRoleModel, RoleStatus } from "./roles.types";
import { getAncestorRoles } from "../../../common/lib/utils";
import { roleHierarchy, Roles } from "../../../common/lib/default-role-hierarchy";


const INITIALIZATION_FLAG = "ROLES_INITIALIZED";

interface SystemFlag {
    _id: string;
    timestamp: Date;
}

const RoleSchema = new Schema<IRole, IRoleModel>({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    descendants: {
        type: [Types.ObjectId],
        ref: "Role",
        default: []
    },
    status: {
        type: String,
        enum: Object.values(RoleStatus),
        default: RoleStatus.ACTIVE
    }
}, { timestamps: true });

RoleSchema.pre("validate", async function (next) {
    if (this.isNew) {
        const ancestorRoleNames = getAncestorRoles(this.name);

        // If no ancestors found, add to root role's descendants
        if (ancestorRoleNames.length === 0) {
            const rootRole = await RoleModel.findOne({ name: Roles.ROOT });
            if (rootRole && !rootRole.descendants.includes(this._id)) {
                rootRole.descendants.push(this._id);
                await rootRole.save();
            }
        } else {
            // Add to all ancestor roles' descendants
            for (const ancestorName of ancestorRoleNames) {
                const ancestorRole = await RoleModel.findOne({ name: ancestorName });
                if (ancestorRole && !ancestorRole.descendants.includes(this._id)) {
                    ancestorRole.descendants.push(this._id);
                    await ancestorRole.save();
                }
            }
        }
    }
    next();
});

// Helper method to ensure a specific role exists
RoleSchema.statics.ensureRole = async function (roleName: string) {
    const existingRole = await this.findOne({ name: roleName });
    if (!existingRole) {
        return await this.create({
            name: roleName,
            descendants: [],
            status: RoleStatus.ACTIVE,
        });
    }
    return existingRole;
};

// Method to ensure all predefined roles exist and maintain correct hierarchy
RoleSchema.statics.ensureRoleHierarchy = async function () {
    try {
        // Ensure database connection
        if (!mongoose.connection.db) {
            throw new Error("Database connection not established");
        }

        // Check if roles are already initialized with proper typing
        const initFlag = await mongoose.connection.db
            .collection<SystemFlag>("system_flags")
            .findOne({ _id: INITIALIZATION_FLAG });

        if (initFlag) {
            console.log("Roles already initialized, skipping...");
            return;
        }

        // Create roles and set up hierarchy
        const rolePromises = Object.values(Roles).map((roleName) =>
            this.ensureRole(roleName)
        );
        await Promise.all(rolePromises);

        const roles = await this.find({ name: { $in: Object.values(Roles) } });
        const roleMap = new Map<string, IRole>();
        roles.forEach((role) => roleMap.set(role.name, role));

        // Set up hierarchy for all roles
        for (const [parentName, childNames] of Object.entries(roleHierarchy)) {
            const parentRole = roleMap.get(parentName);
            if (!parentRole) continue;

            const childIds = childNames
                .map((name) => roleMap.get(name)?._id)
                .filter((id): id is Types.ObjectId => id !== undefined);

            parentRole.descendants = childIds;
            await parentRole.save();
        }

        // Mark initialization as complete with proper typing
        await mongoose.connection.db
            .collection<SystemFlag>("system_flags")
            .insertOne({
                _id: INITIALIZATION_FLAG,
                timestamp: new Date(),
            });

        console.log("Role hierarchy initialized successfully");
        return roles;
    } catch (error) {
        console.error("Error initializing role hierarchy:", error);
        throw error;
    }
};


const RoleModel = mongoose.model<IRole, IRoleModel>("Role", RoleSchema);
export default RoleModel;