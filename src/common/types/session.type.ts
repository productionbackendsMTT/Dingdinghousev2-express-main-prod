export enum PlayerEventTypes {
  PLAYER_ENTERED = "player:entered",
  PLAYER_EXITED = "player:exited",
  PLAYER_GAME_STARTED = "player:game:started",
  PLAYER_GAME_ENDED = "player:game:ended",
  PLAYER_RECONNECTED = "player:reconnected",
}

export interface ISpin {
  betAmount: number;
  winAmount: number;
  timestamp: Date;
}

export interface IGameSession {
  id: string;
  gameId: string;
  gameName: string;
  startedAt: Date;
  endedAt?: Date;
  initialCredit: number;
  finalCredit?: number;
  duration?: number;
  spins: ISpin[];
}

export interface ISession {
  userId: string;
  username: string;
  path: string;
  balanceOnEntry: number;
  balanceOnExit?: number;
  connectedAt: Date;
  disconnectedAt?: Date;
  lastActivity: Date;
  currentGameSessionId?: string;
  gameSessions: IGameSession[];
  isActive: boolean;
}

export interface SessionEvent<T = any> {
  type: PlayerEventTypes;
  userId: string;
  data: T | null;
}
