import { BaseSlotGame } from "../../core/base.slot";
import { GameConfig } from "../../utils/GameConfig";
import { DefaultSlotGame } from "../../core/default.slot";

export class SLCM extends BaseSlotGame {
  private defaultSlotGame: DefaultSlotGame;

  constructor(config: GameConfig) {
    super(config);
    this.defaultSlotGame = new DefaultSlotGame(config);
  }

  spin(): void {
    this.log("Spinning the Cash Machine Slot...");
    this.defaultSlotGame.spin(); 
  }

  evaluateResult(resultMatrix: number[][]): void {
    this.log("Evaluating results in SLCM...");
    this.defaultSlotGame.evaluateResult(resultMatrix);
  }
}

export default SLCM;
