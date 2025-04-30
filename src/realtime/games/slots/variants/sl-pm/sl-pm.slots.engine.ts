import { IPayout } from "../../../../../common/types/payout.type";
import { BaseSlotsEngine } from "../../base.slots.engine";

export class SLPM extends BaseSlotsEngine {
  constructor(game: IPayout) {
    super(game);
    console.log("SLPM initialized");
  }
}
