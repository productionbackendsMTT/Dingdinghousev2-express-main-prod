import { Document, model, Schema, Types } from "mongoose";
import { IToken, IUser, IUserModel, UserStatus } from "../types/user.type";
import {
  generateDefaultPermissions,
  PERMISSION_PATTERN,
  Resource,
} from "../lib/resources";
import Role from "./role.schema";
import { config } from "../config/config";
import bcrypt from "bcrypt";

const TokenSchema = new Schema<IToken>(
  {
    refreshToken: { type: String, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isBlacklisted: { type: Boolean, default: false },
  },
  { _id: false }
);

const ResourcePermissionSchema = new Schema(
  {
    resource: {
      type: String,
      enum: Object.values(Resource),
      required: true,
    },
    permission: {
      type: String,
      validate: {
        validator: (v: string) => PERMISSION_PATTERN.test(v),
        message:
          'Permission must be in format "rwx" where each can be the letter or "-"',
      },
      default: "---",
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: {
      type: Types.ObjectId,
      ref: "Role",
      require: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
      nullable: true,
    },
    totalSpent: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    favouriteGames: {
      type: [Types.ObjectId],
      ref: "Game",
      default: [],
    },
    token: {
      type: TokenSchema,
      default: null,
    },
    path: {
      type: String,
      required: true,
    },
    permissions: {
      type: [ResourcePermissionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Middleware to set the materialized path before saving
UserSchema.pre("validate", async function (next) {
  if (this.isNew) {
    const role = await Role.findById(this.role);
    if (!role) {
      throw new Error("Role is required");
    }

    if (role?.name === config.root.role) {
      const existingAdmin = await User.findOne({
        role: role._id,
        _id: { $ne: this._id }, // Exclude current document
      });

      if (existingAdmin) {
        throw new Error("Admin already exists");
      }

      this.createdBy = undefined;
      this.path = this._id.toString();
      this.balance = Infinity;
      this.permissions = generateDefaultPermissions(role.name);
    } else if (this.createdBy) {
      const parentUser = await User.findById(this.createdBy);
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
UserSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    const user = this as IUser & Document;
    const childUsers = await User.find({ createdBy: user._id });
    if (childUsers.length > 0) {
      return next(
        new Error(
          "Cannot delete user with existing child users. Please delete the child users first."
        )
      );
    }
    next();
  }
);

// Method to get all descendant users using materialized path
UserSchema.methods.getDescendants = async function (): Promise<IUser[]> {
  const descendants = await User.find({
    path: { $regex: `^${this.path}/` },
    status: { $ne: UserStatus.DELETED },
  });
  return descendants;
};

UserSchema.methods.can = function (
  resource: Resource,
  action: "r" | "w" | "x"
): boolean {
  const permission: { resource: string; permission: string } | undefined =
    this.permissions.find(
      (p: { resource: string; permission: string }) => p.resource === resource
    );
  if (!permission) return false;

  const pos = { r: 0, w: 1, x: 2 }[action];
  return permission.permission[pos] === action;
};

UserSchema.methods.getPermissionString = function (resource: Resource): string {
  const permission: { resource: string; permission: string } | undefined =
    this.permissions.find(
      (p: { resource: string; permission: string }) => p.resource === resource
    );
  return permission ? permission.permission : "---";
};

UserSchema.statics.ensureRootUser = async function () {
  const rootRole = await Role.findOne({ name: config.root.role });
  if (!rootRole) {
    throw new Error("Root role must exist before creating root user");
  }

  const rootExists = await this.findOne({ username: config.root.username });
  if (!rootExists) {
    if (!config.root.password) {
      throw new Error("Root password must be defined in the configuration");
    }
    const hashedPassword = await bcrypt.hash(config.root.password, 10);
    return await this.create({
      name: config.root.name,
      username: config.root.username,
      password: hashedPassword,
      role: rootRole._id,
      status: UserStatus.ACTIVE,
      credits: Infinity,
      path: "",
      permissions: generateDefaultPermissions(rootRole.name),
    });
  }
  return rootExists;
};

UserSchema.statics.getAdminIdsFromPath = async function (
  userPath: string
): Promise<Types.ObjectId[]> {
  // For root user - get all direct admin descendants
  if (!userPath.includes("/")) {
    const adminUsers = await this.find({
      path: new RegExp(`^${userPath}/[^/]+$`), // Match direct descendants only
      status: { $ne: UserStatus.DELETED }, // Include any status except DELETED
    });
    return adminUsers.map((admin: IUser & Document) => admin._id);
  }

  // For other users - get their admin's ID from path
  const pathParts = userPath.split("/");
  if (pathParts.length > 1) {
    const adminId = new Types.ObjectId(pathParts[1]);

    // Check if the admin user is not deleted
    const adminUser = await this.findOne({
      _id: adminId,
      status: { $ne: UserStatus.DELETED },
    });

    // Only return the admin ID if the admin is not deleted
    return adminUser ? [adminId] : [];
  }

  return [];
};

const User = model<IUser, IUserModel>("User", UserSchema);
export default User;
