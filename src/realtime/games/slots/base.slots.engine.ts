import { IGame } from "../../../common/types/game.type";
import { IPayout } from "../../../common/types/payout.type";
import { GameEngine } from "../game.engine";
import { SlotGameConfig } from "../game.type";
import { functionUsedConfig, SlotConfig } from "./base.slots.type";

class BaseSlotsEngine extends GameEngine<SlotGameConfig> {
  protected slotConfig: SlotConfig;
  protected functionConfig!: functionUsedConfig;
  constructor(game: IGame & { payout: IPayout }) {
    super(game);
    this.slotConfig = this.config.content;
    console.log("BASE GAME ENGINE INITIALIZED WITH DATA :", this.slotConfig);
  }

  protected validateConfig(): void { }

  public async init(): Promise<void> {
    // console.log(`Initializing slots engine with payout: ${this.config.name}`);
    // Additional initialization logic here
  }

  protected async spin(): Promise<void> {
    console.log(`Spinning the slot ${this.slotConfig.tag} ... `);


  }
}

export default BaseSlotsEngine;
