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

      // Set headers first
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Credentials": "true",
      });

      // Keep socket alive
      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);

      // Check for existing session first
      const existingSession = await this.sessionManager.getSession(userId);

      // Add client before creating session to prevent race conditions
      await this.sseManager.addClient(userId, res);

      // Only create new session if none exists or previous was properly closed
      if (!existingSession || !existingSession.isActive) {
        await this.sessionManager.createSession(user);
      } else {
        // If session exists and is active, send PLAYER_REENTERED event
        await this.sessionManager.publishEvent({
          type: PlayerEventTypes.PLAYER_REENTERED,
          userId,
          data: {
            ...existingSession,
            timestamp: new Date(),
          },
        });
      }

      // Heartbeat
      const heartbeat = setInterval(() => {
        res.write(`event: heartbeat\ndata: ${new Date().toISOString()}\n\n`);
      }, 30000);

      // Handle disconnection
      req.on("close", async () => {
        clearInterval(heartbeat);
        this.sseManager.removeClient(userId);

        const session = await this.sessionManager.getSession(userId);
        if (session) {
          if (!session.currentGame) {
            await this.sessionManager.endSession(userId);
          } else {
            await this.sessionManager.publishEvent({
              type: PlayerEventTypes.PLAYER_EXITED,
              userId,
              data: {
                timestamp: new Date(),
                gameStillActive: true,
                gameId: session.currentGame.session.gameId,
              },
            });
          }
        }
      });

      // Send initial connection event
      const currentSession = await this.sessionManager.getSession(userId);
      res.write(
        `event: connected\ndata: ${JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
          session: currentSession,
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
