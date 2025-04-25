import { DefaultSlotGame } from './default.slot';
import { GameConfig } from '../utils/GameConfig';
import { BaseSlotGame } from './base.slot';
import fs from 'fs';
import path from 'path';

export class GameFactory {
  static create(config: GameConfig): BaseSlotGame {
    try {
      const sanitizedGameId = config.id.replace(/[^a-zA-Z0-9-_]/g, "");
      const specialGamesDir = path.join(__dirname, "../specialGames");

      const filePath = this.findGameFile(specialGamesDir, sanitizedGameId);

      if (!filePath) {
        throw new Error(`Game file for ID "${config.id}" not found.`);
      }

      const GameClass = require(filePath).default || require(filePath)[sanitizedGameId.replace(/-/g, "")];
      if (GameClass) {
        console.log(`Game class found for ${config.id}`);
        return new GameClass(config);
      }

      throw new Error(`Game class for ID "${config.id}" not found in file.`);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`${error.message} Falling back to DefaultSlotGame.`);
      } else {
        console.warn(`An unknown error occurred. Falling back to DefaultSlotGame.`);
      }
      return new DefaultSlotGame(config);
    }
  }

  private static findGameFile(baseDir: string, gameId: string): string | null {
    const sanitizedGameId = gameId.replace(/[^a-zA-Z0-9-_]/g, "");
    const targetFileName = `${sanitizedGameId}.slot.js`; 
    const targetFileNameTs = `${sanitizedGameId}.slot.ts`; 

    const directories = fs.readdirSync(baseDir, { withFileTypes: true });

    for (const dir of directories) {
      if (dir.isDirectory()) {
        const possibleJsPath = path.join(baseDir, dir.name, targetFileName);
        const possibleTsPath = path.join(baseDir, dir.name, targetFileNameTs);

        if (fs.existsSync(possibleJsPath)) {
          return possibleJsPath;
        }
        if (fs.existsSync(possibleTsPath)) {
          return possibleTsPath;
        }
      }
    }

    return null;
  }
}
