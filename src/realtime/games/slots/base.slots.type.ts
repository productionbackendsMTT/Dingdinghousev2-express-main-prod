export interface SlotConfig {
  id: string;
  isSpecial: boolean;
  matrix: {
    x: number;
    y: number;
  };
  linesCount: number[];
  WildMultiplier: number[];
  WildMultiplierProb: number[];
  bets: number[];
  Symbols: SlotSymbol[];
}

export interface SlotSymbol {
  Name: string;
  Id: number;
  useWildSub: boolean;
  isFreeSpinMultiplier: boolean;
  reelInstance: Record<string, number>;
  multiplier: number[][];
}

export interface SlotSpinResult {
  symbols: number[][]; // 2D array representing the reel stop positions
  wins: SlotWin[];
  freeSpinsAwarded?: number;
  bonusTriggered?: boolean;
  totalWin: number;
}

export interface SlotWin {
  line: number;
  symbol: number;
  count: number;
  payout: number;
  positions: number[][]; // [reelIndex][rowIndex]
}

export interface SlotSettings {
  paylines: any[];
  symbols: {
    freeSpin: {
      id: number;
      multiplier: number[];
      use: boolean;
    };
    jackpot: {
      id: number;
      name: string;
      count: number;
      defaultAmount: number;
      increaseValue: number;
      use: boolean;
    };
    wild: {
      id: number;
      name: string;
      use: boolean;
      substitutesFor?: number[]; // Symbol IDs this wild substitutes for
    };
    scatter: {
      id: number;
      multiplier: number[];
      use: boolean;
    };
    bonus: {
      id: number;
      count: number;
      pay: number;
      use: boolean;
    };
  };
  reelStrips: number[][]; // Base reel strips
  freeSpinReelStrips?: number[][]; // Optional separate reel strips for free spins
}
