import mongoose, { Schema, Types } from "mongoose";
import { IPayout } from "./payouts.types";

// Main Payout schema
const PayoutSchema = new Schema<IPayout>({
    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
        required: true,
        index: true
    },
    version: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: false },
    content: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });


// Indexes for faster queries
PayoutSchema.index({ gameId: 1, version: 1 }, { unique: true }); // Compound index for gameId and version
PayoutSchema.index({ gameId: 1, isActive: 1 }); // Index for active payouts


const PayoutModel = mongoose.model<IPayout>("Payout", PayoutSchema);
export default PayoutModel;

