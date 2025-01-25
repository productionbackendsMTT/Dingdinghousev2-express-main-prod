import mongoose, { model, Schema, Types } from "mongoose";
import { ADMIN_PASSWORD, ADMIN_USER_ID, ADMIN_USERNAME, IToken, IUser, IUserModel, UserStatus } from "./users.types";
import { generateDefaultPermissions, PERMISSION_PATTERN, Resource } from "../../utils/resources";
import RoleModel, { ADMIN_ROLE_ID, ADMIN_ROLE_NAME } from "../roles/roles.model";
import bcrypt from 'bcrypt';


const TokenSchema = new Schema<IToken>({
    refreshToken: { type: String, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isBlacklisted: { type: Boolean, default: false }
}, { _id: false })

const ResourcePermissionSchema = new Schema({
    resource: {
        type: String,
        enum: Object.values(Resource),
        required: true
    },
    permission: {
        type: String,
        validate: {
            validator: (v: string) => PERMISSION_PATTERN.test(v),
            message: 'Permission must be in format "rwx" where each can be the letter or "-"'
        },
        default: '---'
    }
}, { _id: false });

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: {
        type: mongoose.Types.ObjectId,
        ref: "Role",
        require: true,
    },
    status: {
        type: String,
        enum: Object.values(UserStatus),
        default: UserStatus.ACTIVE
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: null,
        nullable: true
    },
    totalSpent: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    favouriteGames: {
        type: [String],
        default: []
    },
    token: {
        type: TokenSchema,
        default: null
    },
    path: {
        type: String,
        required: true
    },
    permissions: {
        type: [ResourcePermissionSchema],
        default: []
    }
}, { timestamps: true });


// Middleware to set the materialized path before saving
UserSchema.pre('validate', async function (next) {
    if (this.isNew) {
        const role = await RoleModel.findById(this.role);
        if (!role) {
            throw new Error('Role is required');
        }

        if (role?.name === ADMIN_ROLE_NAME) {
            const existingAdmin = await UserModel.findOne({
                'role': role._id,
                '_id': { $ne: this._id } // Exclude current document
            });

            if (existingAdmin) {
                throw new Error('Admin already exists');
            }

            this.createdBy = undefined;
            this.path = this._id.toString();
            this.balance = Infinity;
            this.permissions = generateDefaultPermissions(role.name);
        } else if (this.createdBy) {
            const parentUser = await UserModel.findById(this.createdBy);
            if (parentUser) {
                this.path = `${parentUser.path}/${this._id}`;
            } else {
                this.path = this._id.toString();
            }
            this.permissions = generateDefaultPermissions(role?.name);
        } else {
            this.path = this._id.toString();
            this.permissions = generateDefaultPermissions(role?.name);
        }
    }
    next();
});

// Middleware to check for child users before deleting
UserSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    const user = this as IUser & mongoose.Document;
    const childUsers = await UserModel.find({ createdBy: user._id });
    if (childUsers.length > 0) {
        return next(new Error('Cannot delete user with existing child users. Please delete the child users first.'));
    }
    next();
})

// Method to get all descendant users using materialized path
UserSchema.methods.getDescendants = async function (): Promise<IUser[]> {
    const descendants = await UserModel.find({ path: { $regex: `^${this.path}/` }, status: { $ne: UserStatus.DELETED } });
    return descendants;
}

UserSchema.methods.can = function (resource: Resource, action: 'r' | 'w' | 'x'): boolean {
    const permission: { resource: string, permission: string } | undefined = this.permissions.find((p: { resource: string, permission: string }) => p.resource === resource);
    if (!permission) return false;

    const pos = { r: 0, w: 1, x: 2 }[action];
    return permission.permission[pos] === action;
};


UserSchema.methods.getPermissionString = function (resource: Resource): string {
    const permission: { resource: string, permission: string } | undefined = this.permissions.find((p: { resource: string, permission: string }) => p.resource === resource);
    return permission ? permission.permission : '---';
};

UserSchema.statics.ensureAdminUser = async function () {
    const adminExists = await this.findOne({ username: ADMIN_USERNAME });
    if (!adminExists) {
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await this.create({
            _id: ADMIN_USER_ID,
            name: 'Administrator',
            username: ADMIN_USERNAME,
            password: hashedPassword,
            role: ADMIN_ROLE_ID,
            status: UserStatus.ACTIVE,
            balance: Infinity
        });
    }
};


const UserModel = model<IUser, IUserModel>("User", UserSchema);
UserModel.ensureAdminUser().catch(console.error);

export default UserModel;