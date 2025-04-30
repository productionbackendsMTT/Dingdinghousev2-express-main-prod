import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { GameConfig } from "./game.type";

export abstract class GameEngine<T extends GameConfig = GameConfig> {
  protected config: T;

  constructor(game: IGame, payout: IPayout) {
    this.config = this.createConfig(game, payout);
    this.validateConfig();
  }

  protected abstract validateConfig(): void;
  public abstract init(): Promise<void>;

  protected createConfig(game: IGame, payout: IPayout): T {
    console.log("GAME ENGINE: ", game, " : ", payout);
    return {
      gameId: game._id.toString(),
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
