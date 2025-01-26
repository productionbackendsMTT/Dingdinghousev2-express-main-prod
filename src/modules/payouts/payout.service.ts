import mongoose from "mongoose";
import { IPayout } from "./payouts.types";
import createHttpError from "http-errors";
import GameModel from "../games/games.model";
import PayoutModel from "./payouts.model";

export class PayoutService {
    async createPayout(gameId: string, content: any, version: number): Promise<IPayout> {
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
            throw createHttpError.BadRequest("Invalid game ID");
        }

        const game = await GameModel.findById(gameId);
        if (!game) {
            throw createHttpError.NotFound("Game not found");
        }

        const existingPayout = await PayoutModel.findOne({ gameId, version });
        if (existingPayout) throw createHttpError.Conflict("A payout with this version already exists");

        const payout = new PayoutModel({ gameId, content, version, isActive: true });
        await payout.save();
        return payout;
    }

    async activatePayout(payoutId: string): Promise<IPayout> {
        if (!mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadGateway("Invalid payout ID");
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const payout = await PayoutModel.findById(payoutId).session(session);
            if (!payout) throw createHttpError.NotFound("Payout not found");

            // Deactivate all other payouts for the same game
            await PayoutModel.updateMany(
                { gameId: payout.gameId, _id: { $ne: payout._id } },
                { $set: { isActive: false } },
                { session }
            );

            // Activate this payout
            payout.isActive = true;
            await payout.save({ session });

            // Update the Game mode's payout refrence 
            await GameModel.updateOne(
                { _id: payout.gameId },
                { $set: { payout: payout._id } },
                { session }
            );

            await session.commitTransaction();
            return payout;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async getPayoutByGame(gameId: string): Promise<IPayout[]> {
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
            throw createHttpError.BadGateway("Invalid game ID");
        }

        const payouts = await PayoutModel.find({ gameId }).sort({ version: -1 });
        return payouts;
    }

    async getActivePayout(gameId: string): Promise<IPayout | null> {
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
            throw createHttpError.BadRequest("Invalid game ID");
        }

        const payout = await PayoutModel.findOne({ gameId, isActive: true });
        return payout;
    }

    async updatePayout(payoutId: string, content: any): Promise<IPayout> {
        if (!mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest("Invalid payout ID");
        }

        const payout = await PayoutModel.findByIdAndUpdate(
            payoutId,
            { content },
            { new: true, runValidators: true }
        );

        if (!payout) {
            throw createHttpError.NotFound("Payout not found");
        }

        return payout;
    }

    async deletePayout(payoutId: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest("Invalid payout ID");
        }

        const payout = await PayoutModel.findByIdAndDelete(payoutId);
        if (!payout) {
            throw createHttpError.NotFound("Payout not found");
        }

        if (payout.isActive) {
            const latestPayout = await PayoutModel.findOne({ gameId: payout.gameId }).sort({ version: -1 });
            if (latestPayout) {
                await this.activatePayout(latestPayout._id.toString())
            }
        }
    }
}