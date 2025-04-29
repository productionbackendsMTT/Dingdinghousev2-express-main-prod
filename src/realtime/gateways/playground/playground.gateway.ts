import { Namespace } from "socket.io";
import { PlaygroundService } from "./playground.service";
import RedisService from "../../../common/config/redis";
import { PlaygroundSocket } from "./playground.types";
import { GameManager } from "../../games/game.manager";

export function setupPlayground(namespace: Namespace) {
  const playgroundService = new PlaygroundService();
  const redisService = RedisService.getInstance();
  const gameManager = GameManager.getInstance();

  namespace.on("connection", async (socket: PlaygroundSocket) => {
    try {
      // Get user and game info from the socket data (set by middleware)
      const userId = socket.data.user.userId;
      const gameId = socket.data.game.id;

      // Get game with payout - now required
      const game = await playgroundService.getGameWithPayout(gameId);
      if (!game || !game.payout) {
        socket.emit("error", {
          message: "Game configuration (payout) not found",
        });
        socket.disconnect(true);
        return;
      }

      // Initialize game engine with payout
      const engine = await gameManager.getGameEngine(game, game.payout);
      await engine.init();

      // Store engine reference
      // socket.data.engine = engine;

      if (game.payout) {
        console.log("Payout Available:", game.payout.name);
        socket.emit("payoutInfo", {
          payoutName: game.payout.name,
          payoutDetails: game.payout, // send full payout object if needed
        });
      } else {
        socket.emit("payoutInfo", {
          payoutName: null,
          message: "No payout available for this game.",
        });
      }

      socket.on("disconnect", () => {
        console.log(`Player disconnected from game ${game.name}`);
      });
    } catch (error) {
      console.error("Connection error:", error);
      socket.emit("error", { message: "Internal server error" });
      socket.disconnect(true);
    }
  });
}
