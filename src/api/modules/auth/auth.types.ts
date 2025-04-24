import { Types } from "mongoose";
import { UserStatus } from "../../../common/types/user.type";
import { IRole } from "../../../common/types/role.type";


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

