import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { SlotConfig } from "./slots/base.slots.type";

export interface SlotGameConfig extends IPayout {
  content: SlotConfig;
}

export enum GameTypesById {
  SL = "SL",
  KN = "KN",
  BJ = "BJ",
}

export enum GamesTypes {
  SLOTS = "slots",
  KENO = "keno",
}

export enum specialIcons {
  bonus = "Bonus",
  scatter = "Scatter",
  jackpot = "Jackpot",
  wild = "Wild",
  any = "any",
  FreeSpin = "FreeSpin"
}