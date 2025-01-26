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

// Middleware to ensure only one active payout per game
PayoutSchema.pre('validate', async function (next) {
    if (this.isActive) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Deactivate all other payouts for the same game
            await mongoose.model("Payout").updateMany(
                { gameId: this.gameId, _id: { $ne: this._id } },
                { $set: { isActive: false } },
                { session }
            )

            // Update the Game model's payout reference
            await mongoose.model("Game").updateOne(
                { _id: this.gameId },
                { $set: { payout: this._id } },
                { session }
            )

            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
    next();
});

const PayoutModel = mongoose.model<IPayout>("Payout", PayoutSchema);
export default PayoutModel;

