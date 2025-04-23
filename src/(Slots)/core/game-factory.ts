import { gameRegistry } from "./game-registry";
import { BaseSlotGame } from "./base.slot";
import { DefaultSlotGame } from "./default.slot";

export class GameFactory {
  static createGame(gameId: string, data: any): BaseSlotGame {
    const GameClass = gameRegistry[gameId];

    if (!GameClass) {
      console.warn(`Game ID "${gameId}" not found. Defaulting to DefaultSlotGame.`);
      return new DefaultSlotGame(data);
    }

    return new GameClass(data);
  }
}
