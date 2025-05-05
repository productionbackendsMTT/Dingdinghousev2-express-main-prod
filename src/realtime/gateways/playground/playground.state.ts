import { Types } from "mongoose";
import RedisService from "../../../common/config/redis";
import User from "../../../common/schemas/user.schema";
import { PlayerState } from "./playground.types";

export class StateService {
  private static instance: StateService;
  private redisService: RedisService;
  private readonly STATE_TTL = 86400; // 24 hours in seconds

  private constructor() {
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(): StateService {
    if (!StateService.instance) {
      StateService.instance = new StateService();
    }
    return StateService.instance;
  }

  // ================= Core State Management =================
  private getStateKey(userId: string, gameId: string | Types.ObjectId): string {
    return `player:${userId}:game:${gameId}:state`;
  }

  private getLockKey(userId: string, gameId: string | Types.ObjectId): string {
    return `lock:${this.getStateKey(userId, gameId)}`;
  }

  /**
   * Public method to use Redis lock with a custom key - makes locks available for other services
   */
  public async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl = 10,
    retries = 3
  ): Promise<T> {
    return this.redisService.withLock(key, callback, ttl, retries);
  }

  async initialize(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<PlayerState> {
    const key = this.getStateKey(userId, gameId);
    const existing = await this.getState(userId, gameId);

    if (existing) return existing;

    const user = await User.findById(userId)
      .select("username balance role status createdBy path")
      .lean();
    if (!user) {
      throw new Error("User not found");
    }

    const initialState: PlayerState = {
      balance: user.balance,
      lastUpdated: new Date(),
      sessionStart: new Date(),
      gameSpecific: {},
      userInfo: {
        username: user.username,
        role:
          user.role instanceof Types.ObjectId
            ? user.role
            : user.role?.toString(),
        status: user.status,
        createdBy: user.createdBy,
        path: user.path?.toString(),
      },
    };

    await this.redisService.setJSON(key, initialState, this.STATE_TTL);
    return initialState;
  }

  async getUserInfo(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<PlayerState["userInfo"] | null> {
    const state = await this.getState(userId, gameId);
    return state?.userInfo || null;
  }

  async syncBalanceToDatabase(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<void> {
    const state = await this.getState(userId, gameId);
    if (!state) return;

    await User.findByIdAndUpdate(userId, {
      balance: state.balance,
    });
  }

  async deductBalanceWithDbSync(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number
  ): Promise<{ success: boolean; newBalance: number }> {
    const result = await this.deductBalance(userId, gameId, amount);
    if (result.success) {
      await this.syncBalanceToDatabase(userId, gameId);
    }
    return result;
  }

  async creditBalanceWithDbSync(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number
  ): Promise<number> {
    const newBalance = await this.creditBalance(userId, gameId, amount);
    await this.syncBalanceToDatabase(userId, gameId);
    return newBalance;
  }

  async getState(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<PlayerState | null> {
    const key = this.getStateKey(userId, gameId);
    return this.redisService.getJSON<PlayerState>(key);
  }

  async updatePlayerState(
    userId: string,
    gameId: string | Types.ObjectId,
    updates: Partial<PlayerState>
  ): Promise<PlayerState> {
    const key = this.getStateKey(userId, gameId);

    return this.withLock(this.getLockKey(userId, gameId), async () => {
      const currentState =
        (await this.getState(userId, gameId)) ||
        (await this.initialize(userId, gameId));

      const updatedState: PlayerState = {
        ...currentState,
        ...updates,
        lastUpdated: new Date(),
      };

      await this.redisService.setJSON(key, updatedState, this.STATE_TTL);
      return updatedState;
    });
  }

  // ================= Balance Operations =================
  async getBalance(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<number> {
    const state = await this.getState(userId, gameId);
    return state?.balance ?? 0; // Added null coalescing to return 0 if state is null
  }

  async deductBalance(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number
  ): Promise<{ success: boolean; newBalance: number }> {
    if (amount <= 0) {
      throw new Error("Deduction amount must be positive");
    }

    return this.withLock(this.getLockKey(userId, gameId), async () => {
      const state =
        (await this.getState(userId, gameId)) ||
        (await this.initialize(userId, gameId));

      if (state.balance < amount) {
        return { success: false, newBalance: state.balance };
      }

      const newBalance = state.balance - amount;
      await this.updatePlayerState(userId, gameId, {
        balance: newBalance,
        currentBet: amount, // Optionally track last bet
      });

      return { success: true, newBalance };
    });
  }

  async creditBalance(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number
  ): Promise<number> {
    if (amount <= 0) {
      throw new Error("Credit amount must be positive");
    }

    return this.withLock(this.getLockKey(userId, gameId), async () => {
      const state =
        (await this.getState(userId, gameId)) ||
        (await this.initialize(userId, gameId));

      const newBalance = state.balance + amount;
      await this.updatePlayerState(userId, gameId, { balance: newBalance });
      return newBalance;
    });
  }

  // ================= Game-Specific State =================
  async getGameSpecificState<T>(
    userId: string,
    gameId: string | Types.ObjectId,
    key: string
  ): Promise<T | undefined> {
    const state = await this.getState(userId, gameId);
    return state?.gameSpecific?.[key] as T;
  }

  async setGameSpecificState(
    userId: string,
    gameId: string | Types.ObjectId,
    key: string,
    value: any
  ): Promise<void> {
    await this.withLock(this.getLockKey(userId, gameId), async () => {
      const state =
        (await this.getState(userId, gameId)) ||
        (await this.initialize(userId, gameId));

      const updatedGameSpecific = {
        ...state.gameSpecific,
        [key]: value,
      };

      await this.updatePlayerState(userId, gameId, {
        gameSpecific: updatedGameSpecific,
      });
    });
  }

  // ================= Session Management =================
  async endSession(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<void> {
    // Could save session data to DB before clearing if needed
    const key = this.getStateKey(userId, gameId);
    await this.redisService.del(key);
  }

  async getSessionDuration(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<number> {
    const state = await this.getState(userId, gameId);
    if (!state) return 0;

    // Handle potential Date object serialization issues
    const sessionStart =
      state.sessionStart instanceof Date
        ? state.sessionStart
        : new Date(state.sessionStart);

    return (new Date().getTime() - sessionStart.getTime()) / 1000;
  }
}
