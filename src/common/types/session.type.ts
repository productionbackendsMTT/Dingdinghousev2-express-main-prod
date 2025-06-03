export enum PlayerEventTypes {
  PLAYER_ENTERED = "player:entered",
  PLAYER_EXITED = "player:exited",
  PLAYER_GAME_STARTED = "player:game:started",
  PLAYER_GAME_ENDED = "player:game:ended",
  PLAYER_RECONNECTED = "player:reconnected",
  PLAYER_ALL = "player:all",
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
  duration?: number;
  initialCredit: number;
  finalCredit?: number;
  spins: ISpin[];
  totalBet?: number;
  totalWin?: number;
}

export interface ISession {
  userId: string;
  username: string;
  path: string;
  balanceOnEntry: number;
  currentBalance: number;
  balanceOnExit?: number;
  connectedAt: Date;
  disconnectedAt?: Date;
  lastActivity: Date;
  currentGame?: {
    session: IGameSession;
    state?: {
      // Temporary game state only in Redis
      [key: string]: any;
      lastBet?: number;
      lastWin?: number;
      lastUpdated?: Date;
    };
  };
  completedGames: IGameSession[];
  isActive: boolean;
}

export interface SessionEvent<T = any> {
  type: PlayerEventTypes;
  userId: string;
  data: T | null;
}
