import { SessionManager } from "../../../api/modules/sessions/sessions.manager";
import { publishToUser, SSEEventTypes } from "../../../common/lib/sse.events";
import { PlayerEventTypes } from "../../../common/types/session.type";
import { ControlSocket } from "./control.types";

class ControlService {
  private static instance: ControlService;
  private sessionManager: SessionManager;

  private constructor() {
    this.sessionManager = SessionManager.getInstance();
  }

  public static getInstance(): ControlService {
    if (!ControlService.instance) {
      ControlService.instance = new ControlService();
    }
    return ControlService.instance;
  }

  public setupListeners(socket: ControlSocket): void {
    socket.on(PlayerEventTypes.PLAYER_GAMES_HISTORY, async ({ userId }) => {
      try {
        const completedGames = await this.sessionManager.getCompletedGames(
          userId,
          {
            limit: 50, // Get last 50 games
            offset: 0,
          }
        );

        socket.emit(PlayerEventTypes.PLAYER_GAMES_HISTORY, {
          userId,
          data: completedGames,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Error fetching game history for user ${userId}:`, error);
        socket.emit(PlayerEventTypes.ERROR, {
          message: "Failed to fetch game history",
        });
      }
    });

    socket.on(PlayerEventTypes.PLAYER_KICKOUT, async ({ userId }) => {
      try {
        if (!userId) {
          socket.emit(PlayerEventTypes.ERROR, {
            message: "Player ID is required for kick action",
          });
          return;
        }

        const playerSession = await this.sessionManager.getSession(userId);
        if (!playerSession) {
          socket.emit(PlayerEventTypes.ERROR, {
            message: "Player session not found",
          });
          return;
        }

        await publishToUser(userId, SSEEventTypes.USER_KICKOUT, {});
      } catch (error) {}
    });
  }
}

export default ControlService;
