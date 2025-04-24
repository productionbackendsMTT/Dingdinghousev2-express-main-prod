import { Types, Document } from "mongoose";

export enum TransactionType {
    RECHARGE = "recharge",
    REDEEM = "redeem",
}

export interface ITransaction extends Document {
    sender: Types.ObjectId;             // User initiating the transaction
    receiver: Types.ObjectId;           // User receiving the transaction
    type: TransactionType;              // Transaction type (recharge/redeem)
    amount: number;                     // Transaction amount
    createdAt: Date;                    // Transaction timestamp
}