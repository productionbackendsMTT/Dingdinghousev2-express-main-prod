import { Types } from "mongoose";
import { IRole } from "../roles/roles.model";
import { UserStatus } from "../users/users.types";


export interface IRegisterRequest {
    name: string;
    username: string;
    password: string;
    balance: number;
    roleId: Types.ObjectId;
    status: UserStatus;
}

export interface IRegisterParams {
    name: string;
    username: string;
    password: string;
    balance: number;
    roleId: Types.ObjectId;
    status: UserStatus;
    createdBy: Types.ObjectId;
}

export interface ILoginResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        _id: Types.ObjectId;
        username: string;
        role: IRole;
        balance: number;
    }
}

