// src/modules/common/RedisGameStateStore.ts

import RedisService from "../../../../common/config/redis";


export class RedisGameStateStore<T extends object> {
  private static _instance: RedisGameStateStore<any>;

  private constructor() { }

  /** Singleton accessor */
  public static getInstance<U extends object>(): RedisGameStateStore<U> {
    if (!RedisGameStateStore._instance) {
      RedisGameStateStore._instance = new RedisGameStateStore<U>();
    }
    return RedisGameStateStore._instance as RedisGameStateStore<U>;
  }

  /** Build the Redis hash key */
  private key(gameId: string, playerId: string): string {
    return `game:${gameId}:user:${playerId}:state`;
  }

  /** Ensure we have a connected client */
  private getClient() {
    const client = RedisService.getInstance().getClient();
    if (!client) {
      throw new Error(
        "Redis client not connected—make sure you’ve called `.connect()` on RedisService first."
      );
    }
    return client;
  }

  /** Load + merge */
  public async load(gameId: string, playerId: string, defaults: T): Promise<T> {
    const client = this.getClient();
    const data = await client.hGetAll(this.key(gameId, playerId));

    if (Object.keys(data).length === 0) {
      return { ...defaults };
    }

    const state: any = { ...defaults };
    for (const [field, raw] of Object.entries(data)) {
      if (raw === "1" || raw === "0") {
        state[field] = raw === "1";
      } else {
        try {
          state[field] = JSON.parse(raw);
        } catch {
          const num = Number(raw);
          state[field] = isNaN(num) ? raw : num;
        }
      }
    }
    return state as T;
  }

  /** Save only the changed fields */
  public async save(
    gameId: string,
    playerId: string,
    delta: Partial<T>,
    ttlSeconds = 60 * 60 * 24
  ): Promise<void> {
    const client = this.getClient();
    const multi = client.multi();

    for (const [field, value] of Object.entries(delta)) {
      if (value === undefined) continue;
      let str: string;
      if (typeof value === "boolean") {
        str = value ? "1" : "0";
      } else if (Array.isArray(value) || typeof value === "object") {
        str = JSON.stringify(value);
      } else {
        str = String(value);
      }
      multi.hSet(this.key(gameId, playerId), field, str);
    }

    multi.expire(this.key(gameId, playerId), ttlSeconds);
    await multi.exec();
  }
}
