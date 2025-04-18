import { Model, Types } from "mongoose";

export enum DescendantOperation {
    ADD = 'add',
    REMOVE = 'remove',
    REPLACE = 'replace'
}

export enum RoleStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted'
}

export interface IRole extends Document {
    _id: Types.ObjectId;
    name: string;
    descendants: Types.ObjectId[];
    status: RoleStatus;
}

export interface IRoleModel extends Model<IRole> {
    ensureAdminRole(): Promise<void>;
    ensurePlayerRole(): Promise<void>;
}

export interface IUpdateRoleParams {
    name?: string;
    status?: RoleStatus;
    descendants?: string[];
    operation?: DescendantOperation;
}