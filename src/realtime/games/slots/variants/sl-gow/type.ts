/**
 * Static symbol definition (from Par sheet)
 */
export interface SymbolDefinition {
  Name: string;
  Id: number;
  reelInstance: Record<string, number>;
  useWildSub: boolean;
  multiplier?: number[][];
  description?: string;
}

/**
 * Immutable game definition (loaded into engine)
 */
export interface GameDefinition {
  id: string;
  matrix: { x: number; y: number };
  bets: number[];
  /** Payline definitions */
  paylines: number[][];
  featureAllMult: number[];
  freeSpinConfig: {
    goldColCountProb: number[];
    goldColProb: number[];
  };
  Symbols: SymbolDefinition[];
}

/**
 * Mutable per-player fields stored in Redis
 */
export interface PlayerGameState {
  isFreeSpin: boolean;
  isTriggered: boolean;
  freeSpinCount: number;
  featureAll: boolean;
  goldWildCols: number[];
  // plus any generic player counters:
  currentWining?: number;
  totalBet?: number;
  haveWon?: number;
  balance?: number;
}

/**
 * Context passed into each spin (bet, RNG, etc.)
 */
export interface SpinContext {
  playerId: string;
  bet: number;
  rng: () => number;
}

/**
 * Result returned by engine, plus deltas to apply to PlayerGameState
 */
export interface SpinResult {
  symbolMatrix: number[][];
  paylinesHit?: number[][];
  payout: number;
  awardedFreeSpins?: number;
  goldWildCols?: number[]; // new goldWild columns if changed
  featureAll?: boolean;
  isFreeSpin?: boolean;
  isTriggered?: boolean;
  freeSpinCountDelta?: number; // +n spins
  deltaState: Partial<PlayerGameState>;
}
