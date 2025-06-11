import { GameAction, GameResponse } from "../../../game.type";

export interface SLPMAction extends GameAction {
    type: "spin";
    payload: {
        betAmount: number;
    };
}
export interface CascadeResult {
    cascadeIndex: number;
    winningLines: Array<{
        lineIndex: number;
        symbols: string;
        positions: number[];
    }>;
    symbolsToFill: string[][];
    currentCascadeWin: number;
}

export interface SLPMResponse {
    id: string;
    success: boolean;
    matrix: string[][];
    cascades: CascadeResult[];
    totalWin: number;
    player: {
        balance: number;
    };
}


export interface SLPMFreeSpinFeature {
    isEnabled: boolean;
    incrementCount: number;
    maxMultiplier: number[]
}

export interface SLPMSymbolConfig {
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

export interface SLPMConfig {
    tag: string;
    matrix: {
        x: number;
        y: number;
    };
    lines: number[][];
    bets: number[];
    minMatchCount: number;
    features: {
        jackpot: {
            enabled: boolean;
            minSymbolCount: number;
            defaultAmount: number;
        }
        freeSpin: SLPMFreeSpinFeature;
    };
    symbols: SLPMSymbolConfig[];
}

export const specialIcons = {
    jackpot: "Jackpot",
};





