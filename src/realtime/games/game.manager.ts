import path from "path";
import fs from "fs";
import { BaseKenoEngine } from "./keno/base.keno.engine";
import { BaseSlotsEngine } from "./slots/base.slots.engine";
import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { GameEngine } from "./game.engine";

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
    game: IGame,
    payout?: IPayout
  ): Promise<GameEngine> {
    if (!payout) {
      throw new Error("Payout configuration is required");
    }

    const [gameType, variant] = game.tag.split("-");
    console.log("TYPE:", gameType);
    console.log("VARIANT:", variant);

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
    const enginePath = this.getEnginePath(gameType, variant);
    if (
      !fs.existsSync(enginePath + ".ts") &&
      !fs.existsSync(enginePath + ".js")
    ) {
      return null;
    }

    const module = await import(enginePath);
    return module[`${gameType}${variant}Engine`] || module.default;
  }

  private getEnginePath(gameType: string, variant: string): string {
    const baseDir = path.join(__dirname, gameType.toLowerCase());
    const possiblePaths = [
      path.join(
        baseDir,
        "variants",
        `${variant}.${gameType.toLowerCase()}.engine`
      ),
      path.join(baseDir, "variants", `${gameType}-${variant}.engine`),
      path.join(baseDir, `${variant}.${gameType.toLowerCase()}.engine`),
      path.join(baseDir, `${gameType}-${variant}.engine`),
    ];

    for (const possiblePath of possiblePaths) {
      if (
        fs.existsSync(possiblePath + ".ts") ||
        fs.existsSync(possiblePath + ".js")
      ) {
        return possiblePath;
      }
    }

    throw new Error(`Engine file not found for ${gameType}-${variant}`);
  }
}
