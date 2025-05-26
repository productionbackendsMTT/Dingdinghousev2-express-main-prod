// src/modules/common/RedisPlayerProfileStore.ts

import RedisService from "../../../../common/config/redis";

export interface PlayerProfile {
  balance: number;
  credits: number;
}

export class RedisPlayerProfileStore {
  private client = RedisService.getInstance().getClient();
  private prefix = "player";

  private makeKey(playerId: string) {
    return `${this.prefix}:${playerId}:profile`;
  }

  async load(playerId: string): Promise<PlayerProfile> {
    const key = this.makeKey(playerId);
    const data = await this.client.hGetAll(key);
    return {
      balance: Number(data.balance) || 0,
      credits: Number(data.credits) || 0,
    };
  }

  async save(playerId: string, delta: Partial<PlayerProfile>): Promise<void> {
    const key = this.makeKey(playerId);
    const multi = this.client.multi();

    if (delta.balance !== undefined) {
      multi.hSet(key, "balance", String(delta.balance));
    }
    if (delta.credits !== undefined) {
      multi.hSet(key, "credits", String(delta.credits));
    }
    // keep around one week
    multi.expire(key, 60 * 60 * 24 * 7);
    await multi.exec();
  }
}
