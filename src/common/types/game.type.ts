import { Document, Types } from "mongoose";

export enum GameStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended'
}

export interface IGame extends Document {
    _id: Types.ObjectId;
    name: string;
    description: string;
    thumbnail: string;
    url: string;
    type: string;
    category: string;
    status: GameStatus;
    tag: string;
    slug: string;
    order: number;

    payout: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}