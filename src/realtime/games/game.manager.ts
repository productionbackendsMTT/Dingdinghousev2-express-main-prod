import path from "path";
import fs from "fs";
import { BaseKenoEngine } from "./keno/base.keno.engine";
import { BaseSlotsEngine } from "./slots/base.slots.engine";
import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { GameEngine } from "./game.engine";
import { GameWithPayout } from "./game.type";

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

  public async getGameEngine(game: GameWithPayout): Promise<GameEngine> {
    if (!game.payout) {
      throw new Error("Payout configuration is required");
    }

    console.log("getGameEngine : ", game);

    const [gameType, variant] = game.tag.split("-");

    // Try to load variant engine first
    try {
      const variantEngine = await this.loadVariantEngine(gameType, variant);
      if (variantEngine) {
        return new variantEngine(game);
      }
    } catch (error) {
      console.error(
        `Error loading variant engine ${gameType}-${variant}:`,
        error
      );
    }

    console.log("VARIANETS FOUND : ", this.loadVariantEngine);

    // Fall back to base engine
    const baseEngine = this.gameEngines.get(gameType);
    if (!baseEngine) {
      throw new Error(`No engine found for game type ${gameType}`);
    }

    return new baseEngine(game.payout);
  }

  private async loadVariantEngine(
    gameType: string,
    variant: string
  ): Promise<any> {
    // Convert to lowercase for consistent path resolution
    const lowerType = gameType.toLowerCase();
    const lowerVariant = variant.toLowerCase();

    // Construct possible module paths
    const possiblePaths = [
      // For structure like sl-pm/pm.slots.engine.ts
      `./${lowerType}/variants/${lowerVariant}/${lowerVariant}.${lowerType}.engine`,
      // For structure like sl-pm/sl-pm.slots.engine.ts
      `./${lowerType}/variants/${lowerType}-${lowerVariant}/${lowerType}-${lowerVariant}.${lowerType}.engine`,
    ];

    for (const modulePath of possiblePaths) {
      try {
        const fullPath = path.join(__dirname, modulePath);
        if (
          fs.existsSync(fullPath + ".ts") ||
          fs.existsSync(fullPath + ".js")
        ) {
          const module = await import(fullPath);
          // Look for class with naming pattern: [GameType][Variant]Engine (e.g., SLPMEngine)
          const variantClassName = `${gameType}${this.toPascalCase(
            variant
          )}Engine`;
          return module[variantClassName] || module.default;
        }
      } catch (error) {
        console.error(`Error loading module at ${modulePath}:`, error);
        continue;
      }
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
