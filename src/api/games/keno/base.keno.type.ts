import { IPayout } from "../../../common/types/payout.type";

// Extend IPayout in KenoGameConfig
export interface KenoGameConfig extends IPayout {
    maxNumbers: number;
    drawNumbers: number;
    payoutTable: Record<number, number>;
    minBet: number;
    maxBet: number;
    gameName: string;

    payout: IPayout;
}
