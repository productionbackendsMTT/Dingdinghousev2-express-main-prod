import { Types } from "mongoose";
import { Socket } from "socket.io";

export interface PlatformPayload {
  userId: string;
}

export interface GameSessionData {
  user: PlatformPayload;
  game: {
    id: string;
  };
}

export interface PlaygroundSocket extends Socket {
  data: GameSessionData;
}

export interface PlayerState {
  // User metadata
  userInfo: {
    username: string;
    role: string | Types.ObjectId;
    status: string;
    createdBy?: Types.ObjectId | null;
    path: string;
  };

  // Core gameplay state
  balance: number;
  currentBet?: number;
  currentLines?: number;
  bonusState?: any;
  lastUpdated: Date;
  sessionStart: Date;
  gameSpecific: Record<string, any>;
}
