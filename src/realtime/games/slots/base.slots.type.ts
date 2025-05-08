import { symbol } from "zod";
import { GameAction, GameResponse } from "../game.type";

export interface SlotAction extends GameAction {
  type: "spin";
  payload: {
    betAmount: number;
    lines: number;
  };
}

export interface SlotResponse extends GameResponse {
  reels: string[][];
  winAmount: number;
  wins: Array<{
    line: number;
    symbols: string[];
    amount: number;
  }>;
  features?: Array<{
    type: string;
    data: any;
  }>;
}
export type BonusType = "spin" | "tap" | "mini-slot";

export interface BonusFeature {
  type: BonusType;
  enabled: boolean;
  payout: Array<{
    [key: string]: number;
  }>;
  minSymbolCount: number;
}
export interface JackpotFeature {
  enabled: boolean;
  minSymbolCount: number;
}

export interface FreeSpinFeature {
  enabled: boolean;
  minSymbolCount: number;
}


export interface GambleFeature {
  type: "card";
  enabled: boolean;
}

export interface SymbolConfig {
  id: number;
  name: string;
  reelsInstance: {
    [key: string]: number;
  };
  useWildSub: boolean;
  multiplier: number[];
  description: string;
  count?: number;
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
    freeSpin: FreeSpinFeature;
  };
  symbols: SymbolConfig[];
}


//   paylines: any[];
//   symbols: {
//     freeSpin: {
//       id: number;
//       multiplier: number[];
//       use: boolean;
//     };
//     jackpot: {
//       id: number;
//       name: string;
//       count: number;
//       defaultAmount: number;
//       increaseValue: number;
//       use: boolean;
//     };
//     wild: {
//       id: number;
//       name: string;
//       use: boolean;
//       substitutesFor?: number[]; // Symbol IDs this wild substitutes for
//     };
//     scatter: {
//       id: number;
//       multiplier: number[];
//       use: boolean;
//     };
//     bonus: {
//       id: number;
//       count: number;
//       pay: number;
//       use: boolean;
//     };
//   };
//   reelStrips: number[][]; // Base reel strips
//   freeSpinReelStrips?: number[][]; // Optional separate reel strips for free spins
// }

// SPIN
export interface settings {
  currentLines: number;
  betPerLine: number;
  // currentBet:
}

// SPIN
export interface settings {
  currentLines: number;
  betPerLine: number;
  // currentBet:
}