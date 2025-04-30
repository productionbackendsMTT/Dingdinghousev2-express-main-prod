import { IGame } from "../../../../../common/types/game.type";
import { IPayout } from "../../../../../common/types/payout.type";
import { BaseSlotsEngine } from "../../base.slots.engine";

class SLPMEngine extends BaseSlotsEngine {
  constructor(game: IGame & { payout: IPayout }) {
    super(game);
    console.log("SLPM initialized");
  }
}

export default SLPMEngine;
