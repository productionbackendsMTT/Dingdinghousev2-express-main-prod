import mongoose, { Model, Types } from "mongoose";
import { IResourcePermission, Resource } from "../../utils/resources";
import { IRole } from "../roles/roles.types";

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended'
}

export enum PermissionOperation {
    ADD = 'add',
    REMOVE = 'remove',
    REPLACE = 'replace'
}

export interface IToken {
    refreshToken: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
    isBlacklisted: boolean;
}

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    username: string;
    password: string;
    balance: number;
    role: Types.ObjectId | IRole;
    status: UserStatus;
    createdBy?: Types.ObjectId | null;
    totalSpent: number;
    totalReceived: number;
    lastLogin?: Date;
    favouriteGames?: string[];
    token?: IToken;
    path: String;
    permissions: IResourcePermission[];
    createdAt: Date;
    updatedAt: Date;
    getDescendants(): Promise<IUser[]>;
    can(resource: Resource, action: 'r' | 'w' | 'x'): boolean;
    getPermissionString(resource: Resource): string;
}

export interface IUserModel extends Model<IUser> {
    ensureAdminUser(): Promise<void>;
}

export interface ITransformedUser {
    _id: mongoose.Types.ObjectId;
    name: string;
    username: string;
    balance: number;
    role: string | null;
    status: UserStatus;
    createdBy: string | null;
    totalSpent: number;
    totalReceived: number;
    lastLogin?: Date;
}
