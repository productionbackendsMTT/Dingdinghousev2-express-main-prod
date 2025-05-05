import path from "path";
import fs from "fs";
import { BaseKenoEngine } from "./keno/base.keno.engine";
import { GameEngine } from "./game.engine";
import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { pathToFileURL } from "url";
import BaseSlotsEngine from "./slots/base.slots.engine";

export class GameManager {
  private static instance: GameManager;
  private gameEngines: Map<string, any> = new Map();

  private constructor() {
    this.gameEngines.set("SL", BaseSlotsEngine);
    this.gameEngines.set("KN", BaseKenoEngine);
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
    console.log("GAME MANAGER : ", game);

    if (!game.payout) {
      throw new Error("Payout configuration is required");
    }

    const [gameType, variant] = game.tag.split("-");

    // Try to load variant engine first
    try {
      const variantEngine = await this.loadVariantEngine(gameType, variant);
      if (variantEngine) {
        return new variantEngine(game); // Pass full game object
      }

      console.log("VARIANETS FOUND : ", variantEngine);
    } catch (error) {
      console.error(
        `Error loading variant engine ${gameType}-${variant}:`,
        error
      );
    }

    // Fall back to base engine
    const baseEngine = this.gameEngines.get(gameType);
    if (!baseEngine) {
      throw new Error(`No engine found for game type ${gameType}`);
    }

    return new baseEngine(game); // Pass full game object
  }

  private async loadVariantEngine(
    gameType: string,
    variant: string
  ): Promise<any> {
    const lowerType = gameType.toLowerCase();
    const lowerVariant = variant.toLowerCase();

    const basePath = path.resolve(
      __dirname,
      `./slots/variants/${lowerType}-${lowerVariant}/${lowerType}-${lowerVariant}.slots.engine`
    );

    const possibleExtensions = [".js", ".ts"];
    const existingPath = possibleExtensions
      .map((ext) => `${basePath}${ext}`)
      .find((filePath) => fs.existsSync(filePath));

    if (!existingPath) {
      console.warn(`No engine file found for: ${basePath}`);
      return null;
    }

    try {
      const module = require(existingPath); // ✅ Use require, not dynamic import
      if (module?.default) {
        console.log(`Loaded default export: ${module.default.name}`);
        return module.default;
      } else {
        console.warn(`No default export in ${existingPath}`);
      }
    } catch (error) {
      console.error(`Failed to require engine from ${existingPath}:`, error);
    }

    return null;
  }

  private toPascalCase(str: string): string {
    return str
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");
  }
}
