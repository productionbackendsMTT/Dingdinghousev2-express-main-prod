import { Model, Types } from "mongoose";
import { IRole } from "./role.type";
import { IResourcePermission, Resource } from "../lib/resources";

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
    ensureRootUser(): Promise<void>;
    getAdminIdsFromPath(userPath: string): Promise<Types.ObjectId[]>;
}