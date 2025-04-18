import mongoose, { Schema, Document } from "mongoose";

// Enum for transaction types
export enum TransactionType {
    RECHARGE = "recharge",
    REDEEM = "redeem",
}

// Interface for TypeScript
export interface ITransaction extends Document {
    sender: mongoose.Types.ObjectId;    // User initiating the transaction
    receiver: mongoose.Types.ObjectId;  // User receiving the transaction
    type: TransactionType;              // Transaction type (recharge/redeem)
    amount: number;                     // Transaction amount
    createdAt: Date;                    // Transaction timestamp
}

// Schema definition
const TransactionSchema: Schema = new Schema({
    sender: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Types.ObjectId,
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

// Export the model
const TransactionModel = mongoose.model<ITransaction>("Transaction", TransactionSchema);
export default TransactionModel;