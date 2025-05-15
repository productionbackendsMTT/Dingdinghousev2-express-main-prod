import { model, Schema, Types } from "mongoose";
import { ITransaction, TransactionType } from "../types/transaction.type";

const TransactionSchema: Schema = new Schema({
    sender: {
        type: Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: Types.ObjectId,
        ref: "User",
        required: true
    },
    type: {
        type: String,
        enum: Object.values(TransactionType),
        required: true
    },
    amount: { type: Number, required: true }
}, { timestamps: true });

const Transaction = model<ITransaction>("Transaction", TransactionSchema);
export default Transaction;