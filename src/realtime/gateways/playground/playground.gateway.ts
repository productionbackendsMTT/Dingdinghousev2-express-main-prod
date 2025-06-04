import { Namespace } from "socket.io";
import PlaygroundService from "./playground.service";
import { PlaygroundSocket } from "./playground.types";
import { Events } from "./playground.events";
import { publishToUser, SSEEventTypes } from "../../../common/lib/sse.events";
import { SessionManager } from "../../../api/modules/sessions/sessions.manager";

export function setupPlayground(namespace: Namespace) {
  const playgroundService = PlaygroundService.getInstance();
  const sessionManager = SessionManager.getInstance();

  namespace.on("connection", async (socket: PlaygroundSocket) => {
    const { userId } = socket.data.user;
    const { id: gameId } = socket.data.game;

    console.log(`Player connecting to game ${gameId}: ${userId}`);

    try {
      // Initialize game engine and get initial state
      const engine = await playgroundService.initialize(gameId, userId);
      const gameName = engine.getConfig().name;

      // Get initial balance from the session
      const session = await sessionManager.getSession(userId);
      if (!session) {
        throw new Error("No active session found");
      }

      const initialCredit = session.currentBalance;

      try {
        // Start game session with retry logic
        const gameSession = await startGameSessionWithRetry(
          sessionManager,
          userId,
          gameId,
          gameName,
          initialCredit,
          3, // max retries
          1000 // retry delay ms
        );

        // Get and send initialization data
        const initData = await engine.getInitData(userId);
        socket.emit(Events.SERVER.INIT_DATA.name, JSON.stringify(initData));

        await publishToUser(userId, SSEEventTypes.GAME_STARTED, {
          userId,
          gameId,
          socketId: socket.id,
          gameSession,
          timestamp: new Date().toISOString(),
        });

        console.log(
          `Game session started for user ${userId}: ${gameSession.id}`
        );
      } catch (error) {
        console.error(
          `Failed to start game session for user ${userId}:`,
          error
        );

        let errorMessage = "Unable to start game session. Please try again.";
        let errorCode = "SESSION_START_ERROR";

        if (error instanceof Error) {
          if (error.message.includes("lock")) {
            errorMessage =
              "Game session is busy. Please wait a moment and try again.";
            errorCode = "SESSION_LOCK_ERROR";
          } else if (error.message.includes("No active session found")) {
            errorMessage = "Please refresh and login again.";
            errorCode = "NO_SESSION_ERROR";
          }
        }

        socket.emit(Events.SERVER.ERROR.name, {
          message: errorMessage,
          code: errorCode,
        });
        socket.disconnect(true);
        return;
      }

      // Handle config update request
      socket.on(
        Events.CLIENT.CONFIG_UPDATE.name,
        async (payload: typeof Events.CLIENT.CONFIG_UPDATE.payload) => {
          try {
            const updatedEngine = await playgroundService.reinitialize(
              gameId,
              payload.content
            );

            // Send the updated config back to the client
            socket.emit(Events.SERVER.CONFIG.name, updatedEngine.getConfig());
          } catch (error) {
            console.error(`Config update error for user ${userId}:`, error);
            socket.emit(Events.SERVER.ERROR.name, {
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to update game configuration",
              code: "CONFIG_UPDATE_ERROR",
            });
          }
        }
      );

      // Handle spin requests
      socket.on(Events.CLIENT.SPIN_REQUEST.name, async (payload) => {
        try {
          const data = JSON.parse(payload);

          const result = await engine.handleAction({
            type: "spin",
            userId,
            payload: {
              betAmount: parseFloat(data.currentBet),
            },
          });

          socket.emit(Events.SERVER.SPIN_RESULT.name, JSON.stringify(result));
        } catch (error) {
          console.error(`Spin error for user ${userId}:`, error);
          socket.emit(
            Events.SERVER.ERROR.name,
            JSON.stringify({
              message:
                error instanceof Error
                  ? error.message
                  : "An unknown error occurred",
              code: "SPIN_ERROR",
            })
          );
        }
      });

      socket.on("disconnect", async () => {
        console.log(`Player disconnecting from game ${gameId}: ${userId}`);

        try {
          // End game session with retry logic
          await endGameSessionWithRetry(sessionManager, userId, 3, 1000);

          await publishToUser(userId, SSEEventTypes.GAME_ENDED, {
            userId,
            gameId,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
          });

          console.log(`Game session ended for user ${userId}`);
        } catch (error) {
          console.error(`Error ending game session for user ${userId}:`, error);
          // Don't throw here as the socket is already disconnecting
        }
      });
    } catch (error) {
      console.error(
        `Connection initialization error for user ${userId}:`,
        error
      );
      socket.emit(Events.SERVER.ERROR.name, {
        message: "Failed to initialize game session",
        code: "INIT_ERROR",
      });

      socket.disconnect(true);
    }
  });
}

/**
 * Start game session with retry logic for lock contention
 */
async function startGameSessionWithRetry(
  sessionManager: SessionManager,
  userId: string,
  gameId: string,
  gameName: string,
  initialCredit: number,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<any> {
  let attempt = 1;

  while (attempt <= maxRetries) {
    try {
      return await sessionManager.startGameSession(
        userId,
        gameId,
        gameName,
        initialCredit
      );
    } catch (error) {
      if (
        attempt === maxRetries ||
        !(
          error instanceof Error &&
          (error.message.includes("lock") || error.message.includes("timeout"))
        )
      ) {
        throw error;
      }

      const delay = delayMs * attempt;
      console.log(
        `Retry ${attempt}/${maxRetries} for game session start, waiting ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }

  throw new Error("Failed to start game session after retries");
}

/**
 * End game session with retry logic
 */
async function endGameSessionWithRetry(
  sessionManager: SessionManager,
  userId: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sessionManager.endGameSession(userId);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      // Only retry on lock-related errors
      if (
        lastError.message.includes("lock") ||
        lastError.message.includes("timeout") ||
        lastError.message.includes("busy")
      ) {
        console.log(
          `Retry ${attempt}/${maxRetries} for user ${userId} game session end`
        );
        await delay(delayMs * attempt);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError || new Error("Failed to end game session after retries");
}

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
