import { DefaultSlotGame } from './default.slot';
import { GameConfig } from '../utils/GameConfig';
import { BaseSlotGame } from './base.slot';
import path from 'path';
export class GameFactory {
  static create(config: GameConfig): BaseSlotGame {
    try {
      const sanitizedGameId = config.id.replace(/[^a-zA-Z0-9-_]/g, "");
      const filePath = path.join(
        __dirname,
        "../specialGames",
        sanitizedGameId,
        `${sanitizedGameId}.slot.ts` 
      );
      console.log("Attempting to load:", filePath);
      const GameClass = require(filePath).default || require(filePath)[sanitizedGameId.replace(/-/g, "")];

      if (GameClass) {
        return new GameClass(config);
      }

      throw new Error(`Game class for ID "${config.id}" not found.`);
    } catch (error) {
      console.warn(`Game class for ID "${config.id}" not found. Falling back to DefaultSlotGame.`);
      return new DefaultSlotGame(config);
    }
  }
}

