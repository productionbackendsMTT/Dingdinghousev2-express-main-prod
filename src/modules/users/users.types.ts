import { Model, Types } from "mongoose";
import { IRole } from "../roles/roles.model";
import { IResourcePermission, Resource } from "../../utils/resources";
import { config } from "../../config/config";

export const ADMIN_USER_ID = new Types.ObjectId("000000000000000000000001");
export const ADMIN_USERNAME = 'admin';
export const ADMIN_PASSWORD = 'admin123';

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended'
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