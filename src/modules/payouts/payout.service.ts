import mongoose, { Types, ClientSession } from "mongoose";
import { IPayout } from "./payouts.types";
import createHttpError from "http-errors";
import GameModel from "../games/games.model";
import PayoutModel from "./payouts.model";

export class PayoutService {

    async createPayout(gameId: Types.ObjectId, payoutFile: { content: any, filename: string }, session: ClientSession): Promise<Types.ObjectId | null> {
        if (!payoutFile) return null;

        const latestVersion = await this.getLatestPayoutVersion(gameId, session);
        const nextVersion = latestVersion ? latestVersion + 1 : 1;

        // Deactivate all previous payouts for this gameId
        await PayoutModel.updateMany(
            { gameId, isActive: true },
            { $set: { isActive: false } },
            { session }
        ).exec();

        // Create new active payout
        const [payout] = await PayoutModel.create([{
            gameId,
            version: nextVersion,
            isActive: true,
            name: payoutFile.filename,
            content: payoutFile.content
        }], { session });

        return payout._id;
    }

    async getLatestPayoutVersion(gameId: Types.ObjectId, session: ClientSession): Promise<number> {
        const latestPayout = await PayoutModel.findOne({ gameId })
            .sort({ version: -1 })
            .select("version")
            .session(session)
            .lean();

        return latestPayout ? latestPayout.version : 0;
    }

    async getPayoutByGame(gameId: string): Promise<IPayout[]> {
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
            throw createHttpError.BadRequest("Invalid game ID");
        }

        const payouts = await PayoutModel.find({ gameId })
            .sort({ version: -1 })
            .lean<IPayout[]>()
            .exec();
        return payouts;
    }

    async activatePayout(payoutId: string): Promise<IPayout> {
        if (!mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest("Invalid payout ID");
        }

        const session = await mongoose.startSession();

        try {
            session.startTransaction();
            const payout = await PayoutModel.findById(payoutId).session(session);
            if (!payout) throw createHttpError.NotFound("Payout not found");

            // Deactivate all other payouts for the same game
            await PayoutModel.updateMany(
                { gameId: payout.gameId, _id: { $ne: payout._id } },
                { $set: { isActive: false } },
                { session }
            ).exec();

            // Activate this payout
            payout.isActive = true;
            await payout.save({ session });

            // Update the Game mode's payout refrence 
            await GameModel.updateOne(
                { _id: payout.gameId },
                { $set: { payout: payout._id } },
                { session }
            ).exec();

            await session.commitTransaction();
            return payout;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }


    async deletePayout(payoutId: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest("Invalid payout ID");
        }

        const payout = await PayoutModel.findById(payoutId);
        if (!payout) {
            throw createHttpError.NotFound("Payout not found");
        }

        if (payout.isActive) {
            const payoutCount = await PayoutModel.countDocuments({ gameId: payout.gameId });
            if (payoutCount === 1) {
                throw createHttpError.BadRequest("Cannot delete the only active payout for this game");
            }
        }

        await PayoutModel.findByIdAndDelete(payoutId);

        if (payout.isActive) {
            const latestPayout = await PayoutModel.findOne({ gameId: payout.gameId }).sort({ version: -1 });
            if (latestPayout) {
                await this.activatePayout(latestPayout._id.toString())
            }
        }
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
        ).exec();

        if (!payout) {
            throw createHttpError.NotFound("Payout not found");
        }

        return payout;
    }

}