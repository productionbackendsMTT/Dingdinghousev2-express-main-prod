export interface GameConfig {
    id: string;
    matrix: { x: number; y: number };
    linesApiData: number[][];
    linesCount: number[];
    bets: number[];
    bonus?: {
      type: string;
      isEnabled: boolean;
      noOfItem?: number;
      payOut?: number[];
      payOutProb?: number[];
    };
    gamble?: {
      type: string;
      isEnabled: boolean;
    };
    Symbols: SymbolConfig[];
  }
  
  export interface SymbolConfig {
    Name: string;
    Id: number;
    reelInstance: Record<number, number>;
    useWildSub: boolean;
    multiplier: [number, number][];
    description?: string;
    defaultAmount?: number;
    symbolsCount?: number;
    increaseValue?: number;
    symbolCount?: number;
  }