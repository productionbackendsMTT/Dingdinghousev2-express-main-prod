import { Response } from "express";
import RedisService from "../config/redis";

// SSE Event Types
export enum SSEEventTypes {
  USER_CONNECTED = "user-connected",
  USER_DISCONNECTED = "user-disconnected",
  GAME_STARTED = "game-started",
  GAME_ENDED = "game-ended",
}

// Redis Channels
export const SSE_REDIS_CHANNEL = "sse-events";

// SSE Client Manager
export class SSEClientManager {
  private static instance: SSEClientManager;
  private clients: Map<string, Response>;
  private redisService: RedisService;

  constructor() {
    this.clients = new Map();
    this.redisService = RedisService.getInstance();
    this.initGlobalSubscription();
  }

  public static getInstance(): SSEClientManager {
    if (!SSEClientManager.instance) {
      SSEClientManager.instance = new SSEClientManager();
    }
    return SSEClientManager.instance;
  }

  private async initGlobalSubscription() {
    await this.redisService.connect();

    // Subscribe to the global Redis channel for broadcasting events
    await this.redisService.subscribe(SSE_REDIS_CHANNEL, (message, channel) => {
      try {
        const eventData = JSON.parse(message);
        this.broadcastToClients(eventData);
      } catch (error) {
        console.error("Error processing SSE Redis message:", error);
      }
    });

    console.log(`Subscribed to global Redis channel: ${SSE_REDIS_CHANNEL}`);
  }

  public async subscribeToUserChannel(userId: string) {
    const userChannel = `sse:user:${userId}`;

    await this.redisService.subscribe(userChannel, (message, channel) => {
      try {
        const eventData = JSON.parse(message);
        console.log(`Received SSE event for user ${userId}:`, eventData);
        this.sendToClient(userId, eventData.type, eventData.data);
      } catch (error) {
        console.error(`Error processing user channel message: ${userChannel}`, error);
      }
    });
    console.log(`Subscribed to user Redis channel: ${userChannel}`);
  }

  public async addClient(userId: string, res: Response): Promise<void> {

    res.write(`id: ${Date.now()}\n`);
    res.write(`event: connected\n`);
    res.write(
      `data: ${JSON.stringify({ message: "SSE connection established" })}\n\n`
    );

    this.clients.set(userId, res);
    await this.subscribeToUserChannel(userId);

    console.log(
      `SSE client connected: ${userId}, total clients: ${this.clients.size}`
    );

    // Handle client disconnection
    res.on("close", () => {
      this.removeClient(userId);
      console.log(
        `SSE client disconnected: ${userId}, remaining clients: ${this.clients.size}`
      );
    });
  }

  // Remove a client connection
  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  // Send event to a specific client
  public sendToClient(clientId: string, eventType: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.write(`id: ${Date.now()}\n`);
      client.write(`event: ${eventType}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (error) {
      console.error(`Error sending SSE event to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  // Broadcast event to all connected clients
  public broadcastToClients(event: { type: string; data: any }): void {
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.write(`id: ${Date.now()}\n`);
        client.write(`event: ${event.type}\n`);
        client.write(`data: ${JSON.stringify(event.data)}\n\n`);
      } catch (error) {
        console.error(`Error broadcasting to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  // Get number of connected clients
  public getClientCount(): number {
    return this.clients.size;
  }
}

// Function to publish SSE events through Redis
export async function publishToSSE(
  eventType: string,
  data: any
): Promise<void> {
  try {
    const redisService = RedisService.getInstance();
    await redisService.publish(
      SSE_REDIS_CHANNEL,
      JSON.stringify({
        type: eventType,
        data: data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error("Error publishing SSE event:", error);
    throw error;
  }
}


export async function publishToUser(userId: string, eventType: string, data: any): Promise<void> {
  console.log(`Publishing SSE event to user ${userId}:`, { eventType, data });
  try {
    const redisService = RedisService.getInstance();
    const userChannel = `sse:user:${userId}`;
    await redisService.publish(
      userChannel,
      JSON.stringify({
        type: eventType,
        data: data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error(`Error publishing SSE event to user ${userId}:`, error);
    throw error;
  }

}