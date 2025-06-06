import { Namespace } from "socket.io";
import PlaygroundService from "./playground.service";
import { PlaygroundSocket } from "./playground.types";
import { Events } from "./playground.events";
import { publishToUser, SSEEventTypes } from "../../../common/lib/sse.events";

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

      // Get and send initialization data
      const initData = await engine.getInitData(userId);
      socket.emit(Events.SERVER.INIT_DATA.name, JSON.stringify(initData));

      await publishToUser(userId, SSEEventTypes.GAME_STARTED, {
        userId,
        gameId,
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

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



      //NOTE: gameble request handler
      socket.on(Events.CLIENT.GAMBLE_REQUEST.name, async (payload) => {
        try {

          const data = JSON.parse(payload);
          const result = await engine.handleAction({
            type: "gamble",
            userId,
            payload: {
              type: data.type,
              lastWinning: data.lastWinning ? parseFloat(data.lastWinning) : 0,
              cardSelected: data.cardSelected || null,
              Event: data.Event || null
            }
          })
          socket.emit(Events.SERVER.GAMBLE_RESULT.name, JSON.stringify(result));

        } catch (e) {
          console.error("Gamble request error:", e);
        }

      })


      socket.on("disconnect", async () => {
        console.log(`Player disconnected from game ${gameId} : ${userId}`);

        await publishToUser(userId, SSEEventTypes.GAME_ENDED, {
          userId,
          gameId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });
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
