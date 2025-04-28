import { FishConfig } from "./keno/base.keno.type";
import { SlotConfig } from "./slots/base.slots.type";

export interface GameConfig {
    _id: string;
    gameId: string;
    name: string;
    version: number;
    isActive: boolean;
    content: SlotConfig | FishConfig;
    createdAt: string;
    updatedAt: string;
}