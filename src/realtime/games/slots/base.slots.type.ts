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

export interface SlotSettings {
    // TODO: Add Types instead any
    paylines: any[];
    symbols: {
        freeSpin: {
            id: string;
            multiplier: []
            started: boolean; // Unknown
            count: number; // Unknown
            added: boolean // Unknown
            use: boolean;
        };
        jackpot: {
            id: number;
            name: string;
            count: number;
            defaultAmount: number;
            increaseValue: number
            use: boolean;
        };
        wild: {
            id: number;
            name: string;
            use: false;
        };
        scatter: {
            id: number;
            multiplier: [],
            use: boolean
        };
        bonus: {
            id: number;
            count: number;
            pay: number;
            start: boolean; // Unknown
            stopIndex: number; // Unknown
            game: any; // Unknown
            use: boolean;
        }
    }


}