import RedisService from "../../../common/config/redis";
import { SessionModel } from "../../../common/schemas/session.schema";
import User from "../../../common/schemas/user.schema";
import {
  IGameSession,
  ISession,
  ISpin,
  PlayerEventTypes,
  SessionEvent,
} from "../../../common/types/session.type";
import { IUser } from "../../../common/types/user.type";

export class SessionManager {
  private static instance: SessionManager;
  private redisService: RedisService;

  private readonly DECIMAL_PRECISION = 4;
  private readonly STATE_TTL = 86400; // 24 hours

  // Redis channels
  private readonly SESSION_CHANNEL = "session:events";
  private readonly SESSION_PREFIX = "session:";
  private readonly USER_SESSION_PREFIX = "user:session:";

  private constructor() {
    this.redisService = RedisService.getInstance();
  }

  private getLockKey(userId: string): string {
    return `lock:session:${userId}`;
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private async withSessionLock<T>(
    userId: string,
    callback: () => Promise<T>,
    ttl = 60
  ): Promise<T> {
    const lockKey = this.getLockKey(userId);
    let attempt = 1;
    const maxAttempts = 5;
    const baseDelay = 200;

    while (attempt <= maxAttempts) {
      try {
        return await this.redisService.withLock(lockKey, callback, ttl);
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }

        // Only retry on lock-related errors
        if (
          error instanceof Error &&
          (error.message.includes("lock") || error.message.includes("timeout"))
        ) {
          const delay = baseDelay * attempt;
          console.log(
            `Retry ${attempt}/${maxAttempts} for session lock ${lockKey}, waiting ${delay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
        } else {
          throw error;
        }
      }
    }
    throw new Error(
      `Failed to acquire session lock after ${maxAttempts} attempts`
    );
  }

  private generateGameSessionId(): string {
    return `gs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Converts string dates back to Date objects after Redis deserialization
   */
  private deserializeSession(session: any): ISession {
    if (!session) return session;

    return {
      ...session,
      connectedAt: new Date(session.connectedAt),
      disconnectedAt: session.disconnectedAt
        ? new Date(session.disconnectedAt)
        : undefined,
      lastActivity: new Date(session.lastActivity),
      currentGame: session.currentGame
        ? {
            ...session.currentGame,
            session: {
              ...session.currentGame.session,
              startedAt: new Date(session.currentGame.session.startedAt),
              endedAt: session.currentGame.session.endedAt
                ? new Date(session.currentGame.session.endedAt)
                : undefined,
              spins:
                session.currentGame.session.spins?.map((spin: any) => ({
                  betAmount: spin.betAmount,
                  winAmount: spin.winAmount,
                  type: spin.type,
                  spunAt: new Date(spin.spunAt),
                  features: spin.features || undefined,
                })) || [],
            },
            state: session.currentGame.state
              ? {
                  ...session.currentGame.state,
                  lastUpdated: session.currentGame.state.lastUpdated
                    ? new Date(session.currentGame.state.lastUpdated)
                    : undefined,
                }
              : undefined,
          }
        : undefined,
      completedGames:
        session.completedGames?.map((game: any) => ({
          ...game,
          startedAt: new Date(game.startedAt),
          endedAt: game.endedAt ? new Date(game.endedAt) : undefined,
          spins:
            game.spins?.map((spin: any) => ({
              betAmount: spin.betAmount,
              winAmount: spin.winAmount,
              type: spin.type,
              spunAt: new Date(spin.spunAt),
              features: spin.features || undefined,
            })) || [],
        })) || [],
    };
  }

  // Create a new session
  public async createSession(user: IUser): Promise<ISession> {
    return this.withSessionLock(user._id.toString(), async () => {
      // Check if session already exists
      const existingSession = await this.getSession(user._id.toString());
      if (existingSession) {
        return existingSession;
      }

      const session: ISession = {
        userId: user._id.toString(),
        username: user.username,
        path: user.path,
        balanceOnEntry: user.balance,
        currentBalance: user.balance,
        connectedAt: new Date(),
        lastActivity: new Date(),
        completedGames: [],
        isActive: true,
      };

      try {
        // Atomic operations
        await Promise.all([
          this.redisService.setJSON(
            `${this.SESSION_PREFIX}${user._id.toString()}`,
            session,
            this.STATE_TTL
          ),
          this.redisService.set(
            `${this.USER_SESSION_PREFIX}${user._id.toString()}`,
            "active",
            this.STATE_TTL
          ),
          SessionModel.create(session),
        ]);

        await this.publishEvent({
          type: PlayerEventTypes.PLAYER_ENTERED,
          userId: user._id.toString(),
          data: session,
        });

        return session;
      } catch (error) {
        // Cleanup on failure
        await Promise.all([
          this.redisService.del(`${this.SESSION_PREFIX}${user._id.toString()}`),
          this.redisService.del(
            `${this.USER_SESSION_PREFIX}${user._id.toString()}`
          ),
        ]);
        throw error;
      }
    });
  }

  // Start game session
  public async startGameSession(
    userId: string,
    gameId: string,
    gameName: string,
    initialCredit: number
  ): Promise<IGameSession> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session) {
        throw new Error("No active session found");
      }

      // End existing game if any
      if (session.currentGame) {
        await this.endGameSessionInternal(session);
      }

      const gameSession: IGameSession = {
        id: this.generateGameSessionId(),
        gameId,
        gameName,
        startedAt: new Date(),
        initialCredit: session.currentBalance,
        spins: [],
      };

      session.currentGame = {
        session: gameSession,
        state: {
          lastUpdated: new Date(),
        },
      };

      session.lastActivity = new Date();
      await this.persistSession(session);

      await this.publishEvent({
        type: PlayerEventTypes.PLAYER_GAME_STARTED,
        userId,
        data: gameSession,
      });

      return gameSession;
    });
  }

  // Handle balance operations
  public async deductBalance(
    userId: string,
    amount: number
  ): Promise<{ success: boolean; newBalance: number }> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session?.currentGame) {
        throw new Error("No active game session found");
      }

      if (session.currentBalance < amount) {
        return { success: false, newBalance: session.currentBalance };
      }

      const newBalance = Number(
        (session.currentBalance - amount).toFixed(this.DECIMAL_PRECISION)
      );

      session.currentBalance = newBalance;
      session.currentGame.state = {
        ...session.currentGame.state,
        lastBet: amount,
        lastUpdated: new Date(),
      };

      // Update user balance and totalSpent in MongoDB
      await User.findByIdAndUpdate(userId, {
        $set: { balance: newBalance },
        $inc: { totalSpent: amount },
      });

      session.lastActivity = new Date();
      await this.persistSession(session);

      return { success: true, newBalance };
    });
  }

  public async creditBalance(userId: string, amount: number): Promise<number> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session?.currentGame) {
        throw new Error("No active game session found");
      }

      const newBalance = Number(
        (session.currentBalance + amount).toFixed(this.DECIMAL_PRECISION)
      );

      session.currentBalance = newBalance;
      session.currentGame.state = {
        ...session.currentGame.state,
        lastWin: amount,
        lastUpdated: new Date(),
      };

      // Update user balance and totalReceived in MongoDB
      await User.findByIdAndUpdate(userId, {
        $set: { balance: newBalance },
        $inc: { totalReceived: amount },
      });

      session.lastActivity = new Date();
      await this.persistSession(session);

      return newBalance;
    });
  }

  public async recordSpin(userId: string, spin: ISpin): Promise<void> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session?.currentGame) {
        throw new Error("No active game session found");
      }

      session.currentGame.session.spins.push({
        betAmount: spin.betAmount,
        winAmount: spin.winAmount,
        type: spin.type,
        spunAt: new Date(),
        features: spin.features,
      });

      if (spin.type === "regular") {
        session.currentGame.session.totalBet =
          (session.currentGame.session.totalBet || 0) + spin.betAmount;
      }
      session.currentGame.session.totalWin =
        (session.currentGame.session.totalWin || 0) + spin.winAmount;

      session.lastActivity = new Date();
      await this.persistSession(session);
    });
  }

  // Internal method that doesn't acquire lock (for use within existing locks)
  private async endGameSessionInternal(
    session: ISession
  ): Promise<IGameSession | null> {
    if (!session?.currentGame) return null;

    const now = new Date();
    const gameSession = session.currentGame.session;

    gameSession.endedAt = now;
    gameSession.duration = now.getTime() - gameSession.startedAt.getTime();
    gameSession.finalCredit = session.currentBalance;

    // Add to completed games
    session.completedGames.push(gameSession);
    session.currentGame = undefined;
    session.lastActivity = now;

    await this.persistSession(session);

    await this.publishEvent({
      type: PlayerEventTypes.PLAYER_GAME_ENDED,
      userId: session.userId,
      data: gameSession,
    });

    return gameSession;
  }

  public async endGameSession(userId: string): Promise<IGameSession | null> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session) return null;

      return await this.endGameSessionInternal(session);
    });
  }

  // End a session
  public async endSession(
    userId: string,
    finalBalance?: number
  ): Promise<ISession | null> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session) return null;

      const now = new Date();

      if (session.currentGame) {
        await this.endGameSessionInternal(session);
      }

      const balanceToSet = finalBalance ?? session.currentBalance;

      session.isActive = false;
      session.disconnectedAt = now;
      session.lastActivity = now;
      session.balanceOnExit = finalBalance ?? session.currentBalance;

      // Update user's balance in MongoDB
      await User.findByIdAndUpdate(userId, {
        balance: balanceToSet,
      });

      await Promise.all([
        this.redisService.del(`${this.SESSION_PREFIX}${userId}`),
        this.redisService.del(`${this.USER_SESSION_PREFIX}${userId}`),
      ]);

      // Update MongoDB with final state
      await SessionModel.findOneAndUpdate(
        { userId, isActive: true },
        {
          $set: {
            isActive: false,
            disconnectedAt: now,
            lastActivity: now,
            balanceOnExit: session.balanceOnExit,
            completedGames: session.completedGames,
          },
        }
      );

      await this.publishEvent({
        type: PlayerEventTypes.PLAYER_EXITED,
        userId,
        data: session,
      });

      return session;
    });
  }

  public async updateGameState(
    userId: string,
    stateUpdates: any
  ): Promise<IGameSession> {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session?.currentGame) {
        throw new Error("No active game session found");
      }

      session.currentGame.state = {
        ...session.currentGame.state,
        ...stateUpdates,
        lastUpdated: new Date(),
      };

      session.lastActivity = new Date();
      await this.persistSession(session);

      return session.currentGame.session;
    });
  }

  public async getCurrentGameSession(
    userId: string
  ): Promise<IGameSession | null> {
    const session = await this.getSession(userId);
    if (!session?.currentGame) return null;
    return session.currentGame.session;
  }

  public async getAllActiveGameSessions(): Promise<
    {
      userId: string;
      gameSession: IGameSession;
    }[]
  > {
    const sessions = await this.getAllActiveSessions();
    const result: { userId: string; gameSession: IGameSession }[] = [];

    for (const session of sessions) {
      if (session.currentGame?.session) {
        result.push({
          userId: session.userId,
          gameSession: session.currentGame.session,
        });
      }
    }

    return result;
  }

  public async getSession(userId: string): Promise<ISession | null> {
    const rawSession = await this.redisService.getJSON(
      `${this.SESSION_PREFIX}${userId}`
    );
    return rawSession ? this.deserializeSession(rawSession) : null;
  }

  public async hasActiveSession(userId: string): Promise<boolean> {
    return this.redisService.exists(`${this.USER_SESSION_PREFIX}${userId}`);
  }

  public async getAllActiveSessions(): Promise<ISession[]> {
    const keys = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
    const sessions = await Promise.all(
      keys.map(async (key) => {
        const rawSession = await this.redisService.getJSON<any>(key);
        if (!rawSession || !rawSession.isActive) return null;
        return this.deserializeSession(rawSession);
      })
    );
    return sessions.filter((s): s is ISession => s !== null);
  }

  public async getCurrentGameState<T = any>(userId: string): Promise<T | null> {
    const session = await this.getSession(userId);
    return (session?.currentGame?.state as T) || null;
  }

  public async setGameStateField<T>(userId: string, field: string, value: T) {
    return this.withSessionLock(userId, async () => {
      const session = await this.getSession(userId);
      if (!session?.currentGame) {
        throw new Error("No active game session found");
      }

      if (!session.currentGame.state) {
        session.currentGame.state = {};
      }

      session.currentGame.state[field] = value;
      session.currentGame.state.lastUpdated = new Date();

      session.lastActivity = new Date();
      await this.persistSession(session);
    });
  }

  public async getGameStateField<T>(
    userId: string,
    field: string
  ): Promise<T | null> {
    const session = await this.getSession(userId);
    if (!session?.currentGame?.state) {
      return null;
    }

    return (session.currentGame.state[field] as T) || null;
  }

  public async getCurrentBalance(userId: string): Promise<number> {
    const session = await this.getSession(userId);
    return session?.currentBalance ?? 0;
  }

  public async getCompletedGames(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<IGameSession[]> {
    const session = await SessionModel.findOne(
      { userId },
      {
        completedGames: {
          $slice: [options.offset || 0, options.limit || 50],
        },
      }
    );

    if (!session) return [];

    let completedGames = session.completedGames;

    if (options.startDate || options.endDate) {
      completedGames = completedGames.filter((game) => {
        if (options.startDate && game.startedAt < options.startDate)
          return false;
        if (options.endDate && game.startedAt > options.endDate) return false;
        return true;
      });
    }

    return completedGames;
  }

  public async publishEvent(event: SessionEvent): Promise<void> {
    await this.redisService.publish(
      this.SESSION_CHANNEL,
      JSON.stringify(event)
    );
  }

  public async cleanupOrphanedSessions(): Promise<number> {
    const activeSessions = await this.getAllActiveSessions();
    const now = new Date();
    const orphanThreshold = 1000 * 60 * 30; // 30 minutes
    let cleanedCount = 0;

    for (const session of activeSessions) {
      const inactiveDuration = now.getTime() - session.lastActivity.getTime();

      if (inactiveDuration > orphanThreshold) {
        try {
          await this.withSessionLock(
            session.userId,
            async () => {
              await this.endSession(session.userId);
              cleanedCount++;
            },
            30
          ); // shorter timeout for cleanup
        } catch (error) {
          console.error(
            `Failed to cleanup session for user ${session.userId}:`,
            error
          );
        }
      }
    }

    return cleanedCount;
  }
  private async persistSession(session: ISession): Promise<void> {
    // Store complete session in Redis including temporary state
    await this.redisService.setJSON(
      `${this.SESSION_PREFIX}${session.userId}`,
      session,
      this.STATE_TTL
    );

    // Store permanent data in MongoDB
    const mongoSession = {
      userId: session.userId,
      username: session.username,
      path: session.path,
      balanceOnEntry: session.balanceOnEntry,
      currentBalance: session.currentBalance,
      balanceOnExit: session.balanceOnExit,
      connectedAt: session.connectedAt,
      disconnectedAt: session.disconnectedAt,
      lastActivity: session.lastActivity,
      isActive: session.isActive,
      completedGames: session.completedGames,
    };

    await SessionModel.findOneAndUpdate(
      { userId: session.userId },
      { $set: mongoSession },
      { upsert: true }
    );
  }
}
