import { Model, Types } from "mongoose";

export enum DescendantOperation {
    ADD = 'add',
    REMOVE = 'remove',
    REPLACE = 'replace'
}

export enum RoleStatus {
    ACTIVE = 'active',
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
    descendants?: string[];
    operation?: DescendantOperation;
}