import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";

export abstract class GameEngine<T extends IPayout = IPayout> {
  protected config: T;

  constructor(protected gameWithPayout: IGame & { payout: IPayout }) {
    this.config = this.createConfig(gameWithPayout.payout);
    this.validateConfig();
  }

  protected abstract validateConfig(): void;
  public abstract init(): Promise<void>;

  protected createConfig(payout: IPayout): T {
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
    } as unknown as T;
  }
}
