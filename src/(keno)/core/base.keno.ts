import { GameConfig } from "../../(Slot)/utils/GameConfig";
export abstract class BaseKenoGame {
  protected config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  abstract spin(): void;
  abstract evaluateResult(resultMatrix: number[][]): void;

  log(message: string) {
    console.log(`[${this.config.id}] ${message}`);
  }
}
