import { GameConfig } from '../../(Slot)/utils/GameConfig';
import { BaseSlotGame } from '../../(Slot)/core/base.slot';
import { DefaultSlotGame } from '../../(Slot)/core/default.slot';
import { BaseKenoGame } from '../../(Keno)/core/base.keno';
import DefaultKenoGame from '../../(Keno)/core/default.keno';
import fs from 'fs';
import path from 'path';
import { GamesTypes } from '../../(Slot)/utils/GameConfig';

export class GameFactory {
  static create(config: GameConfig): BaseSlotGame | BaseKenoGame | undefined {
    const sanitizedGameId = config.id.replace(/[^a-zA-Z0-9-_]/g, "");
    const gameType = this.resolveGameType(sanitizedGameId);
    if (!gameType) {
      console.warn(`Unknown game type for ID "${config.id}".`);
      return undefined;
    }

    try {
      const specialGamesDir = this.getSpecialGamesDir(gameType);
      const filePath = this.findGameFile(specialGamesDir, sanitizedGameId, gameType);

      if (!filePath) {
        throw new Error(`Game file for ID "${config.id}" not found.`);
      }

      const GameClass = this.loadGameClass(filePath, sanitizedGameId);
      if (GameClass) {
        console.log(`Game class found for ID "${config.id}".`);
        return new GameClass(config);
      }

      throw new Error(`Game class for ID "${config.id}" not found in file.`);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : `Unknown error occurred.`);
      return this.getDefaultGame(config, gameType);
    }
  }

  private static resolveGameType(gameId: string): GamesTypes | undefined {
    const prefix = gameId.split("-")[0].toUpperCase();
    const gameTypeMapping: Record<string, GamesTypes> = {
      SL: GamesTypes.SLOTS,
      KN: GamesTypes.KENO,
      // Add new mappings here as needed
    };
    return gameTypeMapping[prefix];
  }

  private static getSpecialGamesDir(gameType: GamesTypes): string {
    return path.join(__dirname, `../../(${gameType})/specialGames`);
  }

  private static findGameFile(baseDir: string, gameId: string, gameType: GamesTypes): string | null {
    const sanitizedGameId = gameId.replace(/[^a-zA-Z0-9-_]/g, "");
    const possibleFileNames = [`${sanitizedGameId}.${gameType.toLowerCase()}.js`, `${sanitizedGameId}.${gameType.toLowerCase()}.ts`];
    for (const fileName of possibleFileNames) {
      const directories = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const dir of directories) {
        if (dir.isDirectory()) {
          const filePath = path.join(baseDir, dir.name, fileName);
          if (fs.existsSync(filePath)) {
            return filePath;
          }
        }
      }
    }
    return null;
  }

  private static loadGameClass(filePath: string, gameId: string): any {
    const sanitizedGameId = gameId.replace(/-/g, "");
    const module = require(filePath);
    return module.default || module[sanitizedGameId];
  }

  private static getDefaultGame(config: GameConfig, gameType: GamesTypes): BaseSlotGame | BaseKenoGame | undefined {
    const defaultGames = {
      [GamesTypes.SLOTS]: () => new DefaultSlotGame(config),
      [GamesTypes.KENO]: () => new DefaultKenoGame(config),
    };
    return defaultGames[gameType]?.() || undefined;
  }
}
