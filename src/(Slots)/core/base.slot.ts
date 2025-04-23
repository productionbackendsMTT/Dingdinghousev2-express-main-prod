import { GameConfig } from "../utils/GameConfig";

export abstract class BaseSlotGame {
  protected config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  abstract spin(): void;
  abstract evaluateResult(): void;

  log(message: string) {
    console.log(`[${this.config.id}] ${message}`);
  }
}
