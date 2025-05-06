export const Events = {
  CLIENT: {
    SPIN_REQUEST: {
      name: "spin:request",
      payload: {} as {
        currentLines: number;
        currentBet: number;
        spins: number;
      },
    },
    // Add other client events
  },
  SERVER: {
    SPIN_RESULT: {
      name: "spin:result",
      payload: {} as {
        success: boolean;
        balance: number;
        reels: string[][];
        winAmount: number;
        wins: Array<{
          line: number;
          symbols: string[];
          amount: number;
        }>;
        features?: Array<{
          type: string;
          data: any;
        }>;
      },
    },
    ERROR: {
      name: "error",
      payload: {} as {
        message: string;
        code: string;
      },
    },
    CONFIG: {
      name: "game:config",
      payload: {} as {
        gameId: string;
        name: string;
        content: any;
        version: number;
        tag: string;
      },
    },
  },
} as const;

export type ClientEventType = keyof typeof Events.CLIENT;
export type ServerEventType = keyof typeof Events.SERVER;
