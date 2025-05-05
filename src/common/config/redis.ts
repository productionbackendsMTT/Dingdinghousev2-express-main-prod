import { createClient, RedisFlushModes } from "redis";
import { EventEmitter } from "events";
import { config } from "./config";

EventEmitter.defaultMaxListeners = 20;

class RedisService {
  private static instance: RedisService;
  private client: ReturnType<typeof createClient> | null = null;
  private pubClient: ReturnType<typeof createClient> | null = null;
  private subClient: ReturnType<typeof createClient> | null = null;
  private connectionUrl: string;

  private constructor() {
    this.connectionUrl = config.redis.url;
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async connect(): Promise<void> {
    if (this.client) return;

    try {
      this.client = createClient({
        url: this.connectionUrl,
        socket: {
          reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
        },
      });

      this.client.on("ready", () => console.log("Redis Client Ready"));
      this.client.on("connect", () => console.log("Redis Client Connected"));
      this.client.on("reconnecting", () =>
        console.log("Redis Client Reconnecting")
      );
      this.client.on("end", () =>
        console.log("Redis Client Connection Closed")
      );

      await this.client.connect();
      await this.createPubSubClients();
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  private async createPubSubClients(): Promise<void> {
    try {
      this.pubClient = this.client!.duplicate();
      this.subClient = this.client!.duplicate();

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

      console.log("Redis Pub/Sub clients connected");
    } catch (error) {
      console.error("Failed to create pub/sub clients:", error);
      throw error;
    }
  }

  // Core Methods
  public getClient(): ReturnType<typeof createClient> {
    if (!this.client) throw new Error("Redis client not connected");
    return this.client;
  }

  public getPublisher(): ReturnType<typeof createClient> {
    if (!this.pubClient) throw new Error("Redis publisher not connected");
    return this.pubClient;
  }

  public getSubscriber(): ReturnType<typeof createClient> {
    if (!this.subClient) throw new Error("Redis subscriber not connected");
    return this.subClient;
  }

  // Key-Value Operations
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    const client = this.getClient();
    const val = typeof value === "string" ? value : JSON.stringify(value);
    await (ttl ? client.set(key, val, { EX: ttl }) : client.set(key, val));
  }

  public async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  public async getJSON<T>(key: string): Promise<T | null> {
    const val = await this.get(key);
    return val ? JSON.parse(val) : null;
  }

  public async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  public async del(key: string): Promise<number> {
    return this.getClient().del(key);
  }

  public async exists(key: string): Promise<boolean> {
    return (await this.getClient().exists(key)) === 1;
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    return await this.getClient().expire(key, seconds);
  }

  public async ttl(key: string): Promise<number> {
    return this.getClient().ttl(key);
  }

  // Lock Management
  public async acquireLock(key: string, ttl = 10): Promise<boolean> {
    return (
      (await this.getClient().set(key, "LOCKED", { NX: true, EX: ttl })) ===
      "OK"
    );
  }

  public async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  public async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl = 10,
    retries = 3,
    delay = 100
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      if (await this.acquireLock(key, ttl)) {
        try {
          const result = await callback();
          await this.releaseLock(key);
          return result;
        } catch (err) {
          await this.releaseLock(key);
          throw err;
        }
      }
      if (i < retries - 1)
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error(`Failed to acquire lock after ${retries} attempts`);
  }

  // Hash Operations
  public async hSet(
    key: string,
    field: string,
    value: string
  ): Promise<number> {
    return this.getClient().hSet(key, field, value);
  }

  public async hGet(key: string, field: string): Promise<string | null> {
    const val = await this.getClient().hGet(key, field);
    return val ?? null;
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    return this.getClient().hGetAll(key);
  }

  public async hDel(key: string, ...fields: string[]): Promise<number> {
    return this.getClient().hDel(key, fields);
  }

  // List Operations
  public async lPush(key: string, ...values: string[]): Promise<number> {
    return this.getClient().lPush(key, values);
  }

  public async rPush(key: string, ...values: string[]): Promise<number> {
    return this.getClient().rPush(key, values);
  }

  public async lPop(key: string): Promise<string | null> {
    return this.getClient().lPop(key);
  }

  public async rPop(key: string): Promise<string | null> {
    return this.getClient().rPop(key);
  }

  // Set Operations
  public async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.getClient().sAdd(key, members);
  }

  public async sRem(key: string, ...members: string[]): Promise<number> {
    return this.getClient().sRem(key, members);
  }

  public async sIsMember(key: string, member: string): Promise<boolean> {
    return await this.getClient().sIsMember(key, member);
  }

  // Pub/Sub
  public async publish(channel: string, message: any): Promise<number> {
    const msg = typeof message === "string" ? message : JSON.stringify(message);
    return this.getPublisher().publish(channel, msg);
  }

  public async subscribe(
    channel: string,
    callback: (message: string, channel: string) => void
  ): Promise<void> {
    await this.getSubscriber().subscribe(channel, callback);
  }

  // Utility Methods
  public async keys(pattern: string): Promise<string[]> {
    return this.getClient().keys(pattern);
  }

  public async flushAll(async = true): Promise<void> {
    await this.getClient().flushAll(
      async ? RedisFlushModes.ASYNC : RedisFlushModes.SYNC
    );
  }

  public async info(section?: string): Promise<string> {
    return section ? this.getClient().info(section) : this.getClient().info();
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.subClient?.quit(),
        this.pubClient?.quit(),
        this.client?.quit(),
      ]);
      this.subClient = null;
      this.pubClient = null;
      this.client = null;
      console.log("Redis connections closed");
    } catch (error) {
      console.error("Error disconnecting from Redis:", error);
      throw error;
    }
  }
}

export default RedisService;
