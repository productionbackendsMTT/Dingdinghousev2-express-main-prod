import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { v4 as uuidv4 } from "uuid";
import { SSEClientManager } from "../../../common/lib/sse.events";

class SSEController {
  sseHanler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.requestingUser._id.toString();

      // Set headers to prevent connection timeout and properly enable SSE
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // For Nginx proxy buffering
        "Access-Control-Allow-Origin": req.headers.origin || "*", // Important for CORS
        "Access-Control-Allow-Credentials": "true", // Important for credentials
      });

      // Set headers to prevent connection timeout
      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);

      // Add client to SSE manager
      const sseManager = SSEClientManager.getInstance();
      await sseManager.addClient(userId, res);

      // Handle client disconnection
      req.on("close", () => {
        sseManager.removeClient(userId);
      });
    } catch (error) {
      next(error);
    }
  };

  sseStatsHandler = (req: Request, res: Response) => {
    const sseManager = SSEClientManager.getInstance();

    res.json({
      connectedClients: sseManager.getClientCount(),
      serverTime: new Date().toISOString(),
    });
  };
}

export default SSEController;
