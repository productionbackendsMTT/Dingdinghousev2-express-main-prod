import { GameEngine } from "../game.engine";
import { SlotConfig, SlotSettings } from "./base.slots.type";

export class SlotBaseEngine extends GameEngine {
    protected slotConfig: SlotConfig;
    protected settings: SlotSettings;
///
    constructor(config: any) {
        super(config);
        this.slotConfig = config.content as SlotConfig;
    }
}