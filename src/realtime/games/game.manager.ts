import path from "path";
import fs from "fs";
import { GameEngine } from "./game.engine";
import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import BaseSlotsEngine from "./slots/base.slots.engine";
import { GamesTypes } from "./game.type";
import LifeOfLuxurySlotsEngine from "./slots/variants/SL-LOL/sl-lol.slots.engine";
import UltimateFirelinkSlotEngine from "./slots/variants/SL-FLC/sl-flc.slots.engine";

export class GameManager {
  private static instance: GameManager;
  private gameEngines: Map<string, any> = new Map();
  private gameEngineInstances: Map<string, GameEngine> = new Map();

  private constructor() {
    this.initializeGameEngines();
  }

  private initializeGameEngines(): void {
    this.gameEngines.set(GamesTypes.SLOTS, BaseSlotsEngine);
    this.gameEngines.set("SL-LOL", LifeOfLuxurySlotsEngine);;
    this.gameEngines.set("SL-FLC", UltimateFirelinkSlotEngine);;
    // this.gameEngines.set(GamesTypes.KENO, BaseKenoEngine);
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  public async getGameEngine(
    game: IGame & { payout: IPayout }
  ): Promise<GameEngine> {
    const gameId = game.payout.gameId.toString();

    if (this.gameEngineInstances.has(gameId)) {
      const existingEngine = this.gameEngineInstances.get(gameId);
      if (existingEngine) {
        return existingEngine;
      }
    }
    const sanitizedGameId = this.sanitizeGameId(game.tag);
    const gameType = GameManager.resolveGameType(sanitizedGameId);

    if (!gameType) {
      throw new Error("Game type could not be resolved.");
    }

    const specialGamesDir = GameManager.getSpecialGamesDir(gameType);
    const filePath = GameManager.findGameFile(
      specialGamesDir,
      sanitizedGameId,
      gameType
    );

    if (!filePath) {
      console.warn(`Game file not found for ID "${game.tag}"  . Using default.`);
      return this.getDefaultGameEngine(game, gameType);
    }

    const GameClass = GameManager.loadGameClass(filePath, sanitizedGameId);

    if (!GameClass) {
      throw new Error(`Game class for ID "${game.tag}" could not be loaded.`);
    }
    const gameEngine = new GameClass(game);
    this.gameEngineInstances.set(gameId, gameEngine);


    return gameEngine;
  }

  private static resolveGameType(gameId: string): GamesTypes | undefined {
    const prefix = gameId.split("-")[0].toUpperCase();
    const gameTypeMapping: Record<string, GamesTypes> = {
      SL: GamesTypes.SLOTS,
      KN: GamesTypes.KENO,
    };
    return gameTypeMapping[prefix];
  }

  private static getSpecialGamesDir(gameType: GamesTypes): string {
    return path.join(
      __dirname,
      `../../../src/realtime/games/${gameType}/variants`
    );
  }

  private static findGameFile(
    baseDir: string,
    gameId: string,
    gameType: GamesTypes
  ): string | null {
    const sanitizedGameId = gameId.replace(/[^a-zA-Z0-9-_]/g, "");
    const possibleFileNames = [
      `${sanitizedGameId.toLowerCase()}.${gameType}.engine.js`,
      `${sanitizedGameId.toLowerCase()}.${gameType}.engine.ts`,
      `engine.ts`
    ];

    if (!fs.existsSync(baseDir)) {
      console.warn(`Directory does not exist: ${baseDir}`);
      return null;
    }

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
    console.warn("gone in dir name")
    return null;
  }
  private static loadGameClass(filePath: string, gameId: string): any {
    const sanitizedGameId = gameId.replace(/-/g, "");
    const module = require(filePath);

    return module.default || module[sanitizedGameId];
  }

  private getDefaultGameEngine(
    game: IGame & { payout: IPayout },
    gameType: GamesTypes
  ): GameEngine<any> {
    const defaultGames: Record<GamesTypes, () => GameEngine<any>> = {
      [GamesTypes.SLOTS]: () => new BaseSlotsEngine(game),
      [GamesTypes.KENO]: () => new BaseSlotsEngine(game),
    };

    const createEngine = defaultGames[gameType];
    if (!createEngine) {
      throw new Error(
        `No default game engine available for game type: ${gameType}`
      );
    }


    const engine = createEngine();
    this.gameEngineInstances.set(game.payout.gameId.toString(), engine);

    return engine;
  }

  private sanitizeGameId(gameId: string): string {
    return gameId.replace(/[^a-zA-Z0-9-_]/g, "");
  }

  public updateGameConfig(
    game: IGame & { payout: IPayout }
  ): GameEngine | null {
    const gameId = game.payout.gameId.toString();
    const existingEngine = this.gameEngineInstances.get(gameId);

    if (existingEngine) {
      existingEngine.updateConfig(game);
      return existingEngine;
    }

    return null;
  }
}
