import { GameAction, GameResponse } from "../../../game.type";

export interface SLPMAction extends GameAction {
    type: "spin";
    payload: {
        betAmount: number;
    };
}
export interface SLPMResponse extends GameResponse {
    matrix?: string[][];
    winningLines: { lineIndex: number; paySymbol: string; win: number, indices: number[]; }[];
    payload?: any
    cascades?: any[]; 
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





