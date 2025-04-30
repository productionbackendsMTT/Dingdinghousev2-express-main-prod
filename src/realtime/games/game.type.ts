import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { FishConfig } from "./keno/base.keno.type";
import { SlotConfig } from "./slots/base.slots.type";

export interface GameConfig {
  gameId: string;
  name: string;
  version: number;
  isActive: boolean;
  content: any; // This will be the payout content
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotGameConfig extends GameConfig {
  content: SlotConfig;
}

export interface FishGameConfig extends GameConfig {
  content: FishConfig;
}

export type GameWithPayout = IGame & { payout?: IPayout };
