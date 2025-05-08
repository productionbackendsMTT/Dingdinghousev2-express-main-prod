import { Types } from "mongoose";
import Game from "../../../common/schemas/game.schema";
import { GameStatus, IGame } from "../../../common/types/game.type";
import { IPayout } from "../../../common/types/payout.type";
import RedisService from "../../../common/config/redis";
import { StateService } from "./playground.state";
import { GameManager } from "../../games/game.manager";
class PlaygroundService {
  private static instance: PlaygroundService;
  private redisService: RedisService;
  private state: StateService;
  private gameManager: GameManager;

  constructor() {
    this.redisService = RedisService.getInstance();
    this.state = StateService.getInstance();
    this.gameManager = GameManager.getInstance();
  }

  public static getInstance(): PlaygroundService {
    if (!PlaygroundService.instance) {
      PlaygroundService.instance = new PlaygroundService();
    }
    return PlaygroundService.instance;
  }

  public async initialize(gameId: string, userId: string) {
    // Get game with payout configuration
    const game = await this.getGameWithPayout(gameId);
    if (!game || !game.payout) {
      throw new Error("Game configuration not found");
    }

    // Initialize game engine
    const engine = await this.gameManager.getGameEngine(game);

    // Initialize player state
    const state = await this.state.initialize(userId, gameId);

    return { engine, state };
  }

  async getGameWithPayout(gameId: Types.ObjectId | string) {
    return Game.findOne({
      _id: gameId,
      status: { $ne: GameStatus.DELETED },
    })
      .populate("payout")
      .lean()
      .exec() as Promise<(IGame & { payout?: IPayout }) | null>;
  }

  async validateToken(
    token: string
  ): Promise<{ gameId: string; platform: string; createdAt: string } | null> {
    try {
      // Get the token data from redis
      const key = `game:token:${token}`;
      const data = await this.redisService.getJSON<{
        gameId: string;
        platform: string;
        createdAt: string;
      }>(key);

      // If no token data found, return null
      if (!data) {
        return null;
      }

      return data;
    } catch (error) {
      console.error("Error validating game token:", error);
      throw error;
    }
  }
}

export default PlaygroundService;
