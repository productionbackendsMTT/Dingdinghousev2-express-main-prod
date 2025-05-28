import { GameAction, GameResponse } from "../../../game.type";

export interface SLLOLAction extends GameAction {
  type: "spin";
  payload: {
    betAmount: number;
  };
}

export interface SLLOLResponse extends GameResponse {
  matrix: string[][];
}

export interface SLLOLGambleFeature {
  type: "card";
  enabled: boolean;
}

export interface SLLOLFreeSpinFeature {
  isEnabled: boolean;
  incrementCount: number;
  maxMultiplier: number[]
}

export interface SLLOLSymbolConfig {
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
  isFreeSpinMultiplier?: boolean;
}

export interface SLLOLConfig {
  tag: string;
  matrix: {
    x: number;
    y: number;
  };
  lines: number[][];
  bets: number[];
  minMatchCount: number;
  features: {
    gamble: SLLOLGambleFeature;
    freeSpin: SLLOLFreeSpinFeature;
  };
  symbols: SLLOLSymbolConfig[];
}

export const SLLOLSpecials = {
  FreeSpin: "FreeSpin",
  Wild: "Wild"
};

export interface WinningCombination {
  symbolId: number;
  positions: [number, number][];
  payout: number;
}
export interface CombinationCheckContext {
  matrix: string[][];
  symbols: SLLOLSymbolConfig[];
  wildSymbolId: string;
  minMatchCount: number;
  betPerLine: number;
}

export interface SLLOLCheckForFreeSpinContext {
  matrix: string[][];
  freeSpinSymbolId: string;
}
