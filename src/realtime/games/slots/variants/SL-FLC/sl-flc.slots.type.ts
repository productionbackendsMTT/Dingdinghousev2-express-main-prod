import { GameAction, GameResponse } from "../../../game.type";

export interface SLFLCAction extends GameAction {
  type: "spin" | "freespin";
  payload: {
    betAmount?: number;
    type?: string;
    option?: number
  };
}

export interface SLFLCResponse extends GameResponse {
  matrix?: string[][];
  payload?: any
}

export interface SLFLCBonusFeature {
  scatterTrigger: Array<{
    count: [number, number];
    rows: number;
  }>;
  scatterValues: number[];
  scatterProbs: number[];
  bonusIncrement: number;
  isEnabled: boolean;
}

export interface SLFLCFreeSpinFeature {
  isEnabled: boolean;
  defaultFreespinOption: number;
  freespinOptions: Array<{ count: number, multiplier: number[] }>
}

export interface SLFLCSymbolConfig {
  id: number;
  enabled: boolean;
  name: string;
  reelsInstance: {
    [key: string]: number;
  };
  useWildSub: boolean;
  multiplier: number[];
  minSymbolCount?: number;
  description?: string;
  defaultAmount?: number;
  useBonus?: boolean;
}

export interface SLFLCConfig {
  tag: string;
  matrix: {
    x: number;
    y: number;
  };
  lines: number[][];
  bets: number[];
  minMatchCount: number;
  features: {
    // gamble: SLFLCGambleFeature;
    bonus: SLFLCBonusFeature;
    freespin: SLFLCFreeSpinFeature;
  };
  symbols: SLFLCSymbolConfig[];
}

export const SLFLCSpecials = {
  Scatter: "Scatter",
  Wild: "Wild",
  Freespin: "Freespin",
  Blank: "Blank"
};

export interface WinningCombination {
  symbolId: number;
  positions: [number, number][];
  payout: number;
}

export interface SLFLCCheckForFreeSpinContext {
  matrix: string[][];
  freeSpinSymbolId: string;
  isEnabled: boolean;
}
export type ValueType = {
  index: [number, number];
  value: number
}
