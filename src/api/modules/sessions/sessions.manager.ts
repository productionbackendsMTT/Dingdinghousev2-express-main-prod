import RedisService from "../../../common/config/redis";
import { SessionModel } from "../../../common/schemas/session.schema";
import {
  IGameSession,
  ISession,
  PlayerEventTypes,
  SessionEvent,
} from "../../../common/types/session.type";
import { IUser } from "../../../common/types/user.type";

export class SessionManager {
  private static instance: SessionManager;
  private redisService: RedisService;

  // Redis channels
  private readonly SESSION_CHANNEL = "session:events";
  private readonly SESSION_PREFIX = "session:";
  private readonly USER_SESSION_PREFIX = "user:session:";

  private constructor() {
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private generateGameSessionId(): string {
    return `gs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create a new session
  public async createSession(user: IUser): Promise<ISession> {
    const session: ISession = {
      userId: user._id.toString(),
      username: user.username,
      path: user.path,
      balanceOnEntry: user.balance,
      connectedAt: new Date(),
      lastActivity: new Date(),
      gameSessions: [],
      isActive: true,
    };

    // Store session data with 24h TTL
    await this.redisService.setJSON(
      `${this.SESSION_PREFIX}${user._id.toString()}`,
      session,
      86400
    );

    // Also maintain a user->session mapping
    await this.redisService.set(
      `${this.USER_SESSION_PREFIX}${user._id.toString()}`,
      "active",
      86400
    );

    // Save in MongoDB
    await SessionModel.create(session);

    // Publish session created event
    await this.publishEvent({
      type: PlayerEventTypes.PLAYER_ENTERED,
      userId: user._id.toString(),
      data: {
        ...session,
      },
    });

    return session;
  }

  // End a session
  public async endSession(
    userId: string,
    finalBalance?: number
  ): Promise<ISession | null> {
    const session = await this.getSession(userId);
    if (!session) return null;

    const now = new Date();

    // End any active game session first
    if (session.currentGameSessionId) {
      await this.endGameSession(userId, session.currentGameSessionId);
    }

    // Update session data
    session.isActive = false;
    session.disconnectedAt = now;
    session.lastActivity = now;
    if (finalBalance !== undefined) {
      session.balanceOnExit = finalBalance;
    }

    // Update Redis
    await Promise.all([
      this.redisService.del(`${this.SESSION_PREFIX}${userId}`),
      this.redisService.del(`${this.USER_SESSION_PREFIX}${userId}`),
    ]);

    // Update MongoDB
    const updateData: Partial<ISession> = {
      isActive: false,
      disconnectedAt: now,
      lastActivity: now,
    };

    if (finalBalance !== undefined) {
      updateData.balanceOnExit = finalBalance;
    }

    await SessionModel.findOneAndUpdate(
      { userId, isActive: true },
      { $set: updateData }
    );

    // Publish session ended event
    await this.publishEvent({
      type: PlayerEventTypes.PLAYER_EXITED,
      userId,
      data: session,
    });

    return session;
  }

  // Start game session
  public async startGameSession(
    userId: string,
    gameId: string,
    gameName: string,
    initialCredit: number
  ): Promise<{ sessionId: string; gameSession: IGameSession }> {
    const session = await this.getSession(userId);
    if (!session) {
      throw new Error("No active session found");
    }

    // End any existing game session first
    if (session.currentGameSessionId) {
      await this.endGameSession(userId, session.currentGameSessionId);
    }

    const gameSessionId = this.generateGameSessionId();
    const gameSession: IGameSession = {
      id: gameSessionId,
      gameId,
      gameName,
      startedAt: new Date(),
      initialCredit,
      spins: [],
    };

    // Update session
    session.currentGameSessionId = gameSessionId;
    session.gameSessions.push(gameSession);
    session.lastActivity = new Date();

    // Persist changes
    await this.persistSession(session);

    // Publish event
    await this.publishEvent({
      type: PlayerEventTypes.PLAYER_GAME_STARTED,
      userId,
      data: gameSession,
    });

    return { sessionId: gameSessionId, gameSession };
  }

  // End game session by ID
  public async endGameSession(
    userId: string,
    gameSessionId: string,
    finalCredit?: number
  ): Promise<IGameSession | null> {
    const session = await this.getSession(userId);
    if (!session) return null;

    const gameSession = session.gameSessions.find(
      (gs) => gs.id === gameSessionId
    );
    if (!gameSession || gameSession.endedAt) return null;

    const now = new Date();
    gameSession.endedAt = now;
    gameSession.duration = now.getTime() - gameSession.startedAt.getTime();

    if (finalCredit !== undefined) {
      gameSession.finalCredit = finalCredit;
    }

    // Clear current game reference if it's this one
    if (session.currentGameSessionId === gameSessionId) {
      session.currentGameSessionId = undefined;
    }

    session.lastActivity = now;

    await this.persistSession(session);

    // Publish event
    await this.publishEvent({
      type: PlayerEventTypes.PLAYER_GAME_ENDED,
      userId,
      data: gameSession,
    });

    return gameSession;
  }

  // Get session by user ID
  public async getSession(userId: string): Promise<ISession | null> {
    return this.redisService.getJSON(`${this.SESSION_PREFIX}${userId}`);
  }

  // Check if user has active session
  public async hasActiveSession(userId: string): Promise<boolean> {
    return this.redisService.exists(`${this.USER_SESSION_PREFIX}${userId}`);
  }

  // Update session activity
  public async updateSessionActivity(userId: string): Promise<void> {
    const session = await this.getSession(userId);
    if (!session) return;

    const now = new Date();
    session.lastActivity = now;

    await this.persistSession(session);
  }

  // Get all active sessions
  // Get all active sessions
  public async getAllActiveSessions(): Promise<ISession[]> {
    const keys = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
    const sessions = await Promise.all(
      keys.map(async (key) => {
        const session = await this.redisService.getJSON<ISession>(key);
        return session && session.isActive ? session : null;
      })
    );
    return sessions.filter((s): s is ISession => s !== null);
  }

  // Get current active game session
  public async getCurrentGameSession(
    userId: string
  ): Promise<IGameSession | null> {
    const session = await this.getSession(userId);
    if (!session || !session.currentGameSessionId) return null;

    return (
      session.gameSessions.find(
        (gs) => gs.id === session.currentGameSessionId && !gs.endedAt
      ) || null
    );
  }

  // Get all active game sessions
  public async getAllActiveGameSessions(): Promise<
    {
      userId: string;
      gameSession: IGameSession;
    }[]
  > {
    const sessions = await this.getAllActiveSessions();
    const result: { userId: string; gameSession: IGameSession }[] = [];

    sessions.forEach((session) => {
      if (session.currentGameSessionId) {
        const gameSession = session.gameSessions.find(
          (gs) => gs.id === session.currentGameSessionId && !gs.endedAt
        );
        if (gameSession) {
          result.push({
            userId: session.userId,
            gameSession,
          });
        }
      }
    });

    return result;
  }

  public async reactivateSession(userId: string): Promise<ISession | null> {
    const session = await this.getSession(userId);
    if (!session) return null;

    session.isActive = true;
    session.lastActivity = new Date();
    session.disconnectedAt = undefined;

    await this.persistSession(session);

    await this.publishEvent({
      type: PlayerEventTypes.PLAYER_RECONNECTED,
      userId,
      data: session,
    });

    return session;
  }

  // Helper method to persist session changes
  private async persistSession(session: ISession): Promise<void> {
    // Update Redis
    await this.redisService.setJSON(
      `${this.SESSION_PREFIX}${session.userId}`,
      session,
      86400
    );

    // Update MongoDB - using atomic operations
    const update: any = {
      $set: {
        lastActivity: session.lastActivity,
        currentGameSessionId: session.currentGameSessionId,
        gameSessions: session.gameSessions,
      },
    };

    await SessionModel.findOneAndUpdate({ userId: session.userId }, update, {
      upsert: true,
    });
  }

  // Publish event to appropriate channels
  public async publishEvent(event: SessionEvent): Promise<void> {
    await this.redisService.publish(
      this.SESSION_CHANNEL,
      JSON.stringify(event)
    );
  }

  // Cleanup orphaned sessions (can be run periodically)
  public async cleanupOrphanedSessions(): Promise<number> {
    const activeSessions = await this.getAllActiveSessions();
    const now = new Date();
    const orphanThreshold = 1000 * 60 * 30; // 30 minutes
    let cleanedCount = 0;

    for (const session of activeSessions) {
      const inactiveDuration = now.getTime() - session.lastActivity.getTime();

      if (inactiveDuration > orphanThreshold) {
        // End the session
        await this.endSession(session.userId, session.balanceOnExit);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
