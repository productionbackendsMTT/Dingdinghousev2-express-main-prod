import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { FishConfig } from "./keno/base.keno.type";
import { SlotConfig } from "./slots/base.slots.type";

export interface SlotGameConfig extends IPayout {
  content: SlotConfig;
}

export interface FishGameConfig extends IPayout {
  content: FishConfig;
}
