import { Types } from "mongoose";

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        _id: Types.ObjectId,
        username: string;
        role: string;
        balance: number
    }
}