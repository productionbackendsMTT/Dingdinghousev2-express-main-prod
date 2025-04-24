import { GameConfig } from "../../utils/GameConfig";
export abstract class CashMachineSlotGame {
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
