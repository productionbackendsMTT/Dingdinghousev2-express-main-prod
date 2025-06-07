import { IPayout } from "../../common/types/payout.type";
import { BonusFeature, SlotConfig } from "./slots/base.slots.type";

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
  player: { balance: number; }
  error?: string;
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

export interface SlotGameConfig extends IPayout {
  content: SlotConfig;
}

export interface BaseInitData {
  player: {
    balance: number;
  };
}

export interface SlotsInitData extends BaseInitData {
  id: string;
  gameData: {
    lines?: number[][];
    bets: number[];
    spinBonus?: number[]
    freespinOptions?: Array<{ count: number; multiplier: number[] }>;
    jackpotMultipliers?: number[]
    bonusTrigger?: Array<{
      count: [number, number];
      rows: number;
    }>

  };
  uiData: {
    paylines: {
      symbols: Array<{
        id: number;
        name: string;
        multiplier: number[];
        description?: string;
        isFreeSpinMultiplier?: boolean;
      }>;
    };
  };
}

export type InitData<T = BaseInitData> = T;
