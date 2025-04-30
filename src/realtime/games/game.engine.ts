import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { GameConfig, GameWithPayout } from "./game.type";

export abstract class GameEngine<T extends GameConfig = GameConfig> {
  protected config: T;

  constructor(payout: IPayout) {
    this.config = this.createConfig(payout);
    this.validateConfig();
  }

  protected abstract validateConfig(): void;
  public abstract init(): Promise<void>;

  protected createConfig(payout: IPayout): T {
    console.log("createConfig : ", payout);

    return {
      gameId: payout.gameId.toString(),
      name: payout.name,
      version: payout.version,
      isActive: payout.isActive,
      content:
        typeof payout.content === "string"
          ? JSON.parse(payout.content)
          : payout.content,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
    } as T;
  }
}
