import { Namespace } from "socket.io";
import { ControlSocket } from "./control.types";
import RedisService from "../../../common/config/redis";
import { SessionManager } from "../../../api/modules/sessions/sessions.manager";
import {
  PlayerEventTypes,
  SessionEvent,
} from "../../../common/types/session.type";

export function setupControl(namespace: Namespace) {
  const redisService = RedisService.getInstance();
  const sessionManager = SessionManager.getInstance();

  namespace.on("connection", async (socket: ControlSocket) => {
    try {
      const { user } = socket.data;
      if (!user || !user.path) {
        console.error("Invalid user connection attempt");
        throw new Error("Invalid user data");
      }

      // Send initial state of all active sessions
      const activeSessions = await sessionManager.getAllActiveSessions();
      socket.emit(PlayerEventTypes.PLAYER_ALL, activeSessions);

      const handleSessionEvent = (message: string) => {
        try {
          const event = JSON.parse(message) as SessionEvent;
          const type = event.type;

          socket.emit(`${type}`, { userId: event.userId, data: event.data });
        } catch (error) {
          console.error("Error processing session event:", error);
        }
      };

      await redisService.subscribe("session:events", handleSessionEvent);

      socket.on("disconnect", async () => {
        await redisService.unsubscribe("session:events");
      });
    } catch (error) {
      console.error("Error in control socket setup:", error);
      socket.disconnect(true);
    }
  });
}
