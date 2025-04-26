import { Types } from "mongoose";
import Game from "../../../common/schemas/game.schema";
import { GameStatus, IGame } from "../../../common/types/game.type";
import { IPayout } from "../../../common/types/payout.type";
import RedisService from "../../../common/config/redis";

export class PlaygroundService {
    private redisService: RedisService;

    constructor() {
        this.redisService = RedisService.getInstance();
    }

    async getGameWithPayout(gameId: Types.ObjectId | string) {
        return Game.findOne({
            _id: gameId,
            status: { $ne: GameStatus.DELETED }
        })
            .populate("payout")
            .lean()
            .exec() as Promise<(IGame & { payout?: IPayout }) | null>;
    }

    async validateToken(token: string): Promise<{ gameId: string; platform: string; createdAt: string; } | null> {
        try {
            // Get the token data from redis
            const key = `game:token:${token}`;
            const data = await this.redisService.getJSON<{ gameId: string, platform: string, createdAt: string }>(key);

            // If no token data found, return null
            if (!data) {
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error validating game token:', error);
            throw error;
        }
    }
}