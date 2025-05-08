import { GameConfig, GameAction, GameResponse } from "./game.type";
import { StateService } from "../../realtime/gateways/playground/playground.state";
import { IGame } from "../../common/types/game.type";
import { IPayout } from "../../common/types/payout.type";
import { PlayerState } from "../../realtime/gateways/playground/playground.types";

export abstract class GameEngine<
  TConfig = any,
  TAction extends GameAction = GameAction,
  TResponse extends GameResponse = GameResponse
> {
  protected state: StateService;
  protected config: GameConfig<TConfig>;

  constructor(game: IGame & { payout: IPayout }) {
    this.state = StateService.getInstance();
    this.config = this.createConfig(game);
    this.validateConfig();
  }

  protected createConfig(
    game: IGame & { payout: IPayout }
  ): GameConfig<TConfig> {
    if (!game.payout) throw new Error("Game payout configuration required");

    return {
      gameId: game.payout.gameId.toString(),
      name: game.payout.name,
      version: game.payout.version,
      tag: game.tag,
      content:
        typeof game.payout.content === "string"
          ? JSON.parse(game.payout.content)
          : game.payout.content,
    };
  }

  public getConfig(): GameConfig<TConfig> {
    return {
      gameId: this.config.gameId,
      name: this.config.name,
      version: this.config.version,
      tag: this.config.tag,
      content: this.config.content,
    };
  }

  abstract validateConfig(): void;
  abstract handleAction(action: TAction): Promise<TResponse>;

  protected async getPlayerState(userId: string) {
    return this.state.getState(userId, this.config.gameId);
  }

  protected async updatePlayerState(
    userId: string,
    updates: Partial<PlayerState>
  ) {
    return this.state.updatePlayerState(userId, this.config.gameId, updates);
  }
}
