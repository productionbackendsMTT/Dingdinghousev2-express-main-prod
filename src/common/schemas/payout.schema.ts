import { model, Schema } from "mongoose";
import { IPayout } from "../types/payout.type";

const PayoutSchema = new Schema<IPayout>({
    gameId: {
        type: Schema.Types.ObjectId,
        ref: "Game",
        required: true,
        index: true
    },
    name: { type: String, required: true },
    version: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: false },
    content: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });


PayoutSchema.index({ gameId: 1, version: 1 }, { unique: true }); // Compound index for gameId and version
PayoutSchema.index({ gameId: 1, isActive: 1 }); // Index for active payouts

const Payout = model<IPayout>("Payout", PayoutSchema);
export default Payout;