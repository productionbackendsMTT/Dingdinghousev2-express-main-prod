import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { SSEClientManager } from "../../../common/lib/sse.events";
import { SessionManager } from "../sessions/sessions.manager";
import { PlayerEventTypes } from "../../../common/types/session.type";

class SSEController {
  private sessionManager = SessionManager.getInstance();
  private sseManager = SSEClientManager.getInstance();

  // Handler for establishing SSE connection
  sseHanler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const user = authReq.requestingUser;
      const userId = user._id.toString();

      // Set headers to prevent connection timeout and properly enable SSE
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // For Nginx proxy buffering
        "Access-Control-Allow-Origin": req.headers.origin || "*", // Important for CORS
        "Access-Control-Allow-Credentials": "true", // Important for credentials
      });

      // Keep socket alive
      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);

      // Register client and session
      await this.sseManager.addClient(userId, res);

      const currentSession = await this.sessionManager.getSession(userId);
      if (!currentSession) {
        // Create new session if doesn't exist
        await this.sessionManager.createSession(user);
      } else if (!currentSession.isActive) {
        // Reactivate session if it was marked inactive
        await this.sessionManager.reactivateSession(userId);
      } else {
        // For existing active sessions, send a reconnection event
        await this.sessionManager.publishEvent({
          type: PlayerEventTypes.PLAYER_RECONNECTED,
          userId,
          data: {
            timestamp: new Date(),
            gameSessionActive:
              currentSession.currentGameSessionId !== undefined,
          },
        });
      }

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        res.write(`event: heartbeat\ndata: ${new Date().toISOString()}\n\n`);
      }, 30000);

      // Handle disconnection
      req.on("close", async () => {
        clearInterval(heartbeat);
        this.sseManager.removeClient(userId);

        const session = await this.sessionManager.getSession(userId);
        if (session) {
          // Only end session if no active game
          if (!session.currentGameSessionId) {
            await this.sessionManager.endSession(userId);
          } else {
            // Just notify about SSE disconnect
            await this.sessionManager.publishEvent({
              type: PlayerEventTypes.PLAYER_EXITED,
              userId,
              data: {
                timestamp: new Date(),
                gameStillActive: true,
              },
            });
          }
        }
      });

      // Send initial connection event
      res.write(
        `event: connected\ndata: ${JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    } catch (error) {
      next(error);
    }
  };

  async sseStatsHandler(req: Request, res: Response) {
    const sessionManager = SessionManager.getInstance();
    const activeSessions = await sessionManager.getAllActiveSessions();

    res.json({
      connectedClients: this.sseManager.getClientCount(),
      activeSessions: activeSessions.length,
      serverTime: new Date().toISOString(),
    });
  }
}

export default SSEController;
