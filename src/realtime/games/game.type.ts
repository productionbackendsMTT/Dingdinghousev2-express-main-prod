import { IPayout } from "../../common/types/payout.type";
import { SlotConfig } from "./slots/base.slots.type";

export interface GameConfig<T = any> {
  gameId: string;
  name: string;
  version: number;
  tag: string;
  content: T;
}

export interface GameAction {
  type: string;
  userId: string;
  payload: Record<string, any>;
}

export interface GameResponse {
  success: boolean;
  balance: number;
  error?: string;
}
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



export interface SpinResult {
  success: boolean;
  balance: number;
  winAmount?: number;
  [key: string]: any; // Allow game-specific properties
}

