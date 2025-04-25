import { Types } from "mongoose";
import Game from "../../../common/schemas/game.schema";
import { GameStatus, IGame } from "../../../common/types/game.type";
import { IPayout } from "../../../common/types/payout.type";

export class PlaygroundService {
    async getGameWithPayout(gameId: Types.ObjectId | string) {
        return Game.findOne({
            _id: gameId,
            status: { $ne: GameStatus.DELETED }
        })
            .populate("payout")
            .lean()
            .exec() as Promise<(IGame & { payout?: IPayout }) | null>;
    }
}