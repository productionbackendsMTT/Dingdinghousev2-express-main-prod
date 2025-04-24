import { GameFactory } from "../../(Slots)/core/game-factory";


export const gameRegistry: Record<string, any> = {
  slots: GameFactory,
//   keno: KenoGameFactory,
//   blackjack: BlackjackGameFactory,
};
