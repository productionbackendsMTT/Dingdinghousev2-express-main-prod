import { Types } from "mongoose";
import RedisService from "../../../common/config/redis";
import User from "../../../common/schemas/user.schema";
import { PlayerState } from "./playground.types";

export class StateService {
  private static instance: StateService;
  private redisService: RedisService;
  private readonly STATE_TTL = 86400; // 24 hours in seconds
  private readonly DECIMAL_PRECISION = 4; // Specify decimal precision

  private constructor() {
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(): StateService {
    if (!StateService.instance) {
      StateService.instance = new StateService();
    }
    return StateService.instance;
  }

  // Helper method to format balance with precision
  private formatBalance(balance: number): number {
    return Number(balance.toFixed(this.DECIMAL_PRECISION));
  }

  // ================= Core State Management =================
  private getStateKey(userId: string, gameId: string | Types.ObjectId): string {
    return `player:${userId}:game:${gameId}:state`;
  }

  private getLockKey(userId: string, gameId: string | Types.ObjectId): string {
    return `player:${userId}:game:${gameId}:state:lock`;
  }

  /**
   * Public method to use Redis lock with a custom key - makes locks available for other services
   * Fixed to use more consistent lock naming and avoid double prefixing
   */
  public async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl = 60 // Increased from 30 to 60 seconds
  ): Promise<T> {
    // Make sure we don't double-prefix lock keys
    const lockKey = key.startsWith("lock:") ? key : `lock:${key}`;
    const redis = RedisService.getInstance();
    return redis.withLock(lockKey, callback, ttl);
  }

  async initialize(
    userId: string,
    gameId: string | Types.ObjectId
  ): Promise<PlayerState> {
    const key = this.getStateKey(userId, gameId);
    const existing = await this.getState(userId, gameId);

    if (existing) return existing;

    // Use a lock when initializing state to prevent duplicate creation
    return this.withLock(`initialize:${userId}:${gameId}`, async () => {
      // Check again inside the lock to ensure no race condition
      const checkAgain = await this.getState(userId, gameId);
      if (checkAgain) return checkAgain;

      // Get user with balance information
      const user = await User.findById(userId)
        .select("username balance role status createdBy path")
        .lean();

      if (!user) {
        throw new Error("User not found");
      }

      // Ensure balance is a number and properly initialized with precision
      const rawBalance = typeof user.balance === "number" ? user.balance : 0;
      const balance = this.formatBalance(rawBalance);
      console.log("Initializing player state with balance:", balance);

      const initialState: PlayerState = {
        balance: balance, // Use the formatted balance with proper precision
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

      // Log the state being saved
      console.log("Saving initial player state:", initialState);

      await this.redisService.setJSON(key, initialState, this.STATE_TTL);

      // Verify the saved state
      const savedState = await this.getState(userId, gameId);
      console.log("Verified saved state:", savedState);

      return initialState;
    });
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

    // No need to lock for DB sync, we're just reading current state
    await User.findByIdAndUpdate(userId, {
      balance: state.balance,
    });
  }

  async deductBalanceWithDbSync(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number
  ): Promise<{ success: boolean; newBalance: number }> {
    // Format the amount with proper precision
    const formattedAmount = this.formatBalance(amount);

    // Use a single lock for the entire operation
    return this.withLock(this.getLockKey(userId, gameId), async () => {
      const result = await this.deductBalance(
        userId,
        gameId,
        formattedAmount,
        false
      );
      if (result.success) {
        await User.findByIdAndUpdate(userId, {
          balance: result.newBalance,
        });
      }
      return result;
    });
  }

  async creditBalanceWithDbSync(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number
  ): Promise<number> {
    // Format the amount with proper precision
    const formattedAmount = this.formatBalance(amount);

    // Use a single lock for the entire operation
    return this.withLock(this.getLockKey(userId, gameId), async () => {
      const newBalance = await this.creditBalance(
        userId,
        gameId,
        formattedAmount,
        false
      );
      await User.findByIdAndUpdate(userId, {
        balance: newBalance,
      });
      return newBalance;
    });
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
    updates: Partial<PlayerState>,
    useLock = true
  ): Promise<PlayerState> {
    const key = this.getStateKey(userId, gameId);

    // Format balance if it exists in updates
    if (updates.balance !== undefined) {
      updates.balance = this.formatBalance(updates.balance);
    }

    const updateFunc = async () => {
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
    };

    if (useLock) {
      return this.withLock(this.getLockKey(userId, gameId), updateFunc);
    } else {
      return updateFunc();
    }
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
    amount: number,
    useLock = true
  ): Promise<{ success: boolean; newBalance: number }> {
    if (amount <= 0) {
      throw new Error("Deduction amount must be positive");
    }

    // Format the amount with proper precision
    const formattedAmount = this.formatBalance(amount);

    const deductFunc = async () => {
      const state =
        (await this.getState(userId, gameId)) ||
        (await this.initialize(userId, gameId));

      if (state.balance < formattedAmount) {
        return { success: false, newBalance: state.balance };
      }

      const newBalance = this.formatBalance(state.balance - formattedAmount);
      await this.updatePlayerState(
        userId,
        gameId,
        {
          balance: newBalance,
          currentBet: formattedAmount, // Optionally track last bet
        },
        false // Don't use another lock since we're already in one
      );

      return { success: true, newBalance };
    };

    if (useLock) {
      return this.withLock(this.getLockKey(userId, gameId), deductFunc);
    } else {
      return deductFunc();
    }
  }

  async creditBalance(
    userId: string,
    gameId: string | Types.ObjectId,
    amount: number,
    useLock = true
  ): Promise<number> {
    if (amount <= 0) {
      throw new Error("Credit amount must be positive");
    }

    // Format the amount with proper precision
    const formattedAmount = this.formatBalance(amount);

    const creditFunc = async () => {
      const state =
        (await this.getState(userId, gameId)) ||
        (await this.initialize(userId, gameId));

      const newBalance = this.formatBalance(state.balance + formattedAmount);
      await this.updatePlayerState(
        userId,
        gameId,
        { balance: newBalance },
        false // Don't use another lock since we're already in one
      );
      return newBalance;
    };

    if (useLock) {
      return this.withLock(this.getLockKey(userId, gameId), creditFunc);
    } else {
      return creditFunc();
    }
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

      await this.updatePlayerState(
        userId,
        gameId,
        {
          gameSpecific: updatedGameSpecific,
        },
        false // Don't use another lock since we're already in one
      );
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
