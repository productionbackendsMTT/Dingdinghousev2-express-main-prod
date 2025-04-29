import { IGame } from "../../../common/types/game.type";
import { IPayout } from "../../../common/types/payout.type";
import { GameEngine } from "../game.engine";
import { SlotGameConfig } from "../game.type";
import { SlotConfig } from "./base.slots.type";

export class BaseSlotsEngine extends GameEngine<SlotGameConfig> {
  protected slotConfig: SlotConfig;

  constructor(game: IGame, payout: IPayout) {
    super(game, payout);
    this.slotConfig = this.config.content;
  }

  protected validateConfig(): void {
    if (!this.slotConfig.matrix || !this.slotConfig.bets) {
      throw new Error("Invalid slot configuration - missing required fields");
    }
  }

  public async init(): Promise<void> {
    console.log(`Initializing slots engine with payout: ${this.config.name}`);
    // Additional initialization logic here
  }
}
