import { BaseSlotGame } from "./base.slot";

export class DefaultSlotGame extends BaseSlotGame {
  spin(): void {
    this.log("Default game spin logic executed.");
  }

  evaluateResult(): void {
    this.log("Default game result evaluation executed.");
  }
}
