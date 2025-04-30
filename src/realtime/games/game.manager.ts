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
    console.log("GameManager instance created.");
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
    if (!game.payout) {
      throw new Error("Payout configuration is required.");
    }

    const [gameType, variant] = game.tag.split("-");
    console.log(`Requested game engine for type: ${gameType}, variant: ${variant}`);

    // Try to load variant engine first
    const variantEngine = await this.loadVariantEngine(gameType, variant);
    if (variantEngine) {
      console.log(`Variant engine loaded: ${gameType}-${variant}`);
      return new variantEngine(game);
    }

    // Fallback to base engine
    const baseEngine = this.gameEngines.get(gameType);
    if (!baseEngine) {
      throw new Error(`No engine found for game type ${gameType}`);
    }

    console.log(`Fallback to base engine for type: ${gameType}`);
    return new baseEngine(game.payout);
  }

  private async loadVariantEngine(gameType: string, variant: string): Promise<any | null> {
    try {
      const enginePath = this.findVariantEnginePath(gameType, variant);
      if (!enginePath) {
        console.log(`No variant engine found for ${gameType}-${variant}`);
        return null;
      }

      const module = await import(enginePath);
      console.log(`Variant engine module loaded from path: ${enginePath}`);
      return module[`${gameType}${variant}Engine`] || module.default;
    } catch (error) {
      console.error(`Failed to load variant engine for ${gameType}-${variant}:`, error);
      return null;
    }
  }

  private findVariantEnginePath(gameType: string, variant: string): string | null {
    const baseDir = path.join(__dirname, "..", "games", "slots", "variants");
    const possibleFileNames = [
      `${variant}.${gameType}.slots.engine`,
      `${gameType}-${variant}.slots.engine`,
    ];
    console.log(possibleFileNames)
    for (const fileName of possibleFileNames) {
      const tsPath = path.join(baseDir, `${fileName}.ts`);
      const jsPath = path.join(baseDir, `${fileName}.js`);
      console.log(tsPath)
      if (fs.existsSync(tsPath)) {
        return tsPath;
      }

      if (fs.existsSync(jsPath)) {
        return jsPath;
      }
    }

    console.log(`No engine file found for type: ${gameType}, variant: ${variant}`);
    return null;
  }

}