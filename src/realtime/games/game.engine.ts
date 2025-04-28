import { GameConfig } from "./game.type";

export abstract class GameEngine {
    protected config: GameConfig;

    constructor(config: GameConfig) {
        this.config = config;
    }
}