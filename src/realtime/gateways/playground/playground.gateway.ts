import { Namespace } from "socket.io";
import PlaygroundService from "./playground.service";
import { PlaygroundSocket } from "./playground.types";
import { Events } from "./playground.events";

export function setupPlayground(namespace: Namespace) {
  const playgroundService = PlaygroundService.getInstance();

  namespace.on("connection", async (socket: PlaygroundSocket) => {
    try {
      const { userId } = socket.data.user;
      const { id: gameId } = socket.data.game;

      const { engine, state } = await playgroundService.initialize(
        gameId,
        userId
      );
      // Send game configuration to client using the public getter
      socket.emit(Events.SERVER.CONFIG.name, engine.getConfig());

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
          const result = await engine.handleAction({
            type: "spin",
            userId,
            payload: {
              betAmount: payload.currentBet,
              lines: payload.currentLines,
            },
          });

          socket.emit(Events.SERVER.SPIN_RESULT.name, result);
        } catch (error) {
          socket.emit(Events.SERVER.ERROR.name, {
            message:
              error instanceof Error
                ? error.message
                : "An unknown error occurred",
            code: "SPIN_ERROR",
          });
        }
      });

      socket.on("disconnect", () => {
        console.log(`Player disconnected from game ${gameId}`);
      });
    } catch (error) {
      console.error("Connection error:", error);
      socket.emit(Events.SERVER.ERROR.name, {
        message: "Failed to initialize game session",
        code: "INIT_ERROR",
      });
      socket.disconnect(true);
    }
  });
}
