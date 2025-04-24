import { Types } from "mongoose";
import { UserStatus } from "../users/users.types";
import { IRole } from "../roles/roles.types";


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

