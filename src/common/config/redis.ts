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
  public async acquireLock(key: string, ttl = 60): Promise<boolean> {
    try {
      const client = this.getClient();
      const lockValue = Date.now().toString(); // Use timestamp as lock value for debugging

      const result = await client.set(key, lockValue, {
        NX: true,
        EX: ttl,
      });

      const success = result === "OK";

      if (!success) {
        // Check remaining TTL for debugging
        const remainingTtl = await client.ttl(key);
        // console.log(`Existing lock ${key} has ${remainingTtl}s remaining`);
      }

      return success;
    } catch (error) {
      console.error(`Error acquiring lock for ${key}:`, error);
      return false;
    }
  }

  public async releaseLock(key: string): Promise<void> {
    try {
      const exists = await this.exists(key);
      if (!exists) {
        // console.log(`Lock ${key} already released or expired`);
        return;
      }

      const released = await this.del(key);
    } catch (error) {
      console.error(`Error releasing lock for ${key}:`, error);
    }
  }

  public async withLock<T>(
    key: string,
    callback: () => Promise<T>,
    ttl = 60, // Increased from 30 to 60 seconds for complex operations
    retries = 8, // Increased from 5 to 8
    delay = 300 // Increased from 200 to 300ms
  ): Promise<T> {
    const lockKey = `redis_lock:${key}`;
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        if (await this.acquireLock(lockKey, ttl)) {
          try {
            // console.log(`Lock acquired for ${lockKey}, executing callback...`);
            const startTime = Date.now();
            const result = await callback();
            const duration = Date.now() - startTime;
            // console.log(`Callback for ${lockKey} completed in ${duration}ms`);

            await this.releaseLock(lockKey);
            // console.log(`Lock released for ${lockKey}`);
            return result;
          } catch (err) {
            console.error(`Error during locked operation for ${lockKey}:`, err);
            await this.releaseLock(lockKey);
            throw err;
          }
        }

        if (i < retries - 1) {
          // Add jitter to the delay to prevent synchronized retries
          const jitteredDelay = delay + Math.floor(Math.random() * 200);
          console.log(
            `Retry ${i + 1
            }/${retries} for lock ${lockKey} after ${jitteredDelay}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
        } else {
          lastError = new Error(
            `Failed to acquire lock after ${retries} attempts for key: ${lockKey}`
          );
        }
      } catch (error) {
        console.error(`Unexpected error in withLock for ${lockKey}:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this was an error in acquiring/releasing the lock, we should retry
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // If we got here, all retries failed
    throw lastError || new Error(`Failed to acquire lock for key: ${lockKey}`);
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
