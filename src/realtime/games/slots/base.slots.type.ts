import { GameAction, GameResponse } from "../game.type";

export interface SlotAction extends GameAction {
  type: "spin";
  payload: {
    betAmount: number;
  };
}

export interface SlotResponse extends GameResponse {
  matrix: string[][];
}
export type BonusType = "spin" | "tap" | "mini-slot";

export interface JackpotFeature {
  enabled: boolean;
  minSymbolCount: number;
  defaultAmount: number;
}

export interface BonusFeature {
  type: BonusType;
  enabled: boolean;
  payout: Array<{
    [key: string]: number;
  }>;
  minSymbolCount: number;
}

export interface GambleFeature {
  type: "card";
  enabled: boolean;
}

export interface SymbolConfig {
  id: number;
  enabled: boolean;
  name: string;
  reelsInstance: {
    [key: string]: number;
  };
  useWildSub: boolean;
  multiplier: number[];
  minSymbolCount?: number;
  description: string;
  defaultAmount?: number;
}

export interface SlotConfig {
  tag: string;
  matrix: {
    x: number;
    y: number;
  };
  lines: number[][];
  bets: number[];
  features: {
    bonus: BonusFeature;
    gamble: GambleFeature;
    jackpot: JackpotFeature;
  };
  symbols: SymbolConfig[];
}

export const specialIcons = {
  bonus: "Bonus",
  scatter: "Scatter",
  jackpot: "Jackpot",
  FreeSpin: "FreeSpin",
};
