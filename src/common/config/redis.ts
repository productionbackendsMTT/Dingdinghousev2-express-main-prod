import { createClient } from 'redis';
import { EventEmitter } from 'events';
import { config } from './config';

EventEmitter.defaultMaxListeners = 20;

// Singleton Redis client
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

    // Connect to Redis
    public async connect(): Promise<void> {
        if (this.client) return;

        try {
            // Create main client using connection URL
            this.client = createClient({
                url: this.connectionUrl,
                socket: {
                    reconnectStrategy: (retries) => Math.min(retries * 50, 2000), // Exponential backoff
                }
            });

            this.client.on('ready', () => console.log('Redis Client Ready'));
            this.client.on('connect', () => console.log('Redis Client Connected'));
            this.client.on('reconnecting', () => console.log('Redis Client Reconnecting'));
            this.client.on('end', () => console.log('Redis Client Connection Closed'));

            await this.client.connect();
            await this.createPubSubClients();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    // Create dedicated pub/sub clients
    private async createPubSubClients(): Promise<void> {
        try {
            // Create publisher client
            this.pubClient = this.client!.duplicate();
            await this.pubClient.connect();

            // Create subscriber client
            this.subClient = this.client!.duplicate();
            await this.subClient.connect();

            console.log('Redis Pub/Sub clients connected');
        } catch (error) {
            console.error('Failed to create pub/sub clients:', error);
            throw error;
        }
    }

    // Get the main client
    public getClient(): ReturnType<typeof createClient> {
        if (!this.client) {
            throw new Error('Redis client not connected. Call connect() first.');
        }
        return this.client;
    }

    // Get publisher client
    public getPublisher(): ReturnType<typeof createClient> {
        if (!this.pubClient) {
            throw new Error('Redis publisher not connected. Call connect() first.');
        }
        return this.pubClient;
    }

    // Get subscriber client
    public getSubscriber(): ReturnType<typeof createClient> {
        if (!this.subClient) {
            throw new Error('Redis subscriber not connected. Call connect() first.');
        }
        return this.subClient;
    }

    // Publish a message to a channel
    public async publish(channel: string, message: any): Promise<number> {
        const publisher = this.getPublisher();
        return await publisher.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
    }

    // Subscribe to a channel
    public async subscribe(channel: string, callback: (message: string, channel: string) => void): Promise<void> {
        const subscriber = this.getSubscriber();
        await subscriber.subscribe(channel, callback);
    }

    // Set a key-value pair with optional expiration
    public async set(key: string, value: any, expireSeconds?: number): Promise<void> {
        const client = this.getClient();
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        if (expireSeconds) {
            await client.set(key, stringValue, { EX: expireSeconds });
            console.log("SET : ", key)
        } else {
            await client.set(key, stringValue);
        }
    }

    // Get a value by key
    public async get(key: string): Promise<string | null> {
        const client = this.getClient();
        return await client.get(key);
    }

    // Get a JSON value by key
    public async getJSON<T>(key: string): Promise<T | null> {
        const value = await this.get(key);
        if (!value) return null;

        try {
            return JSON.parse(value) as T;
        } catch (error) {
            console.error(`Error parsing JSON from Redis key ${key}:`, error);
            return null;
        }
    }

    // Delete a key
    public async del(key: string): Promise<number> {
        const client = this.getClient();
        return await client.del(key);
    }

    // Check if a key exists
    public async exists(key: string): Promise<number> {
        const client = this.getClient();
        return await client.exists(key);
    }

    // Get all keys matching a pattern
    public async keys(pattern: string): Promise<string[]> {
        const client = this.getClient();
        return await client.keys(pattern);
    }

    // Close all connections
    public async disconnect(): Promise<void> {
        try {
            if (this.subClient) {
                await this.subClient.quit();
                this.subClient = null;
            }

            if (this.pubClient) {
                await this.pubClient.quit();
                this.pubClient = null;
            }

            if (this.client) {
                await this.client.quit();
                this.client = null;
            }

            console.log('Redis connections closed');
        } catch (error) {
            console.error('Error disconnecting from Redis:', error);
            throw error;
        }
    }
}

export default RedisService;