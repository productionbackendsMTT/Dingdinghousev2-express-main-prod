// src/modules/games/god-of-wealth/service.ts
import { PlayerGameState, SpinContext, SpinResult } from "./type";
import { gameDefinition } from "./config";
import { spin } from "./engine";
import { RedisGameStateStore } from "../../common/RedisGameStateStore";

// Grab the singleton store, typing it for your PlayerGameState
const stateStore = RedisGameStateStore.getInstance<PlayerGameState>();

export async function processSpin(
  playerId: string,
  bet: number,
  rng: () => number
): Promise<SpinResult> {
  // 1) Define your default state inline (or import from a constants file)
  const defaults: PlayerGameState = {
    isFreeSpin: false,
    isTriggered: false,
    freeSpinCount: 0,
    featureAll: false,
    goldWildCols: [],
    currentWining: 0,
    totalBet: 0,
    haveWon: 0,
    balance: 0,
  };

  // 2) Load + merge
  const state = await stateStore.load(gameDefinition.id, playerId, defaults);

  // 3) Do your spin
  const ctx: SpinContext = { playerId, bet, rng };
  const result = spin(gameDefinition, ctx, state);

  // 4) Save only the delta back into Redis
  await stateStore.save(
    gameDefinition.id,
    playerId,
    result.deltaState
  );

  return result;
}
