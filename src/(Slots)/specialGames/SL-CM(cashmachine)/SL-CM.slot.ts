import { BaseSlotGame } from "../../core/base.slot";
import { GameConfig } from "../../utils/GameConfig";


export class SLCM extends BaseSlotGame {
  constructor(config: GameConfig) {
    super(config);
  }

  spin(): void {
    this.log("Spinning the Cash Machine Slot...");
  }

  evaluateResult(resultMatrix: number[][]): void {
    this.log("Evaluating results...");
  }
}

export default SLCM; // Ensure compatibility with dynamic imports
