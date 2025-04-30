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
  },
  SERVER: {
    SPIN_RESULT: {
      name: "spin:result",
      payload: {} as {
        winAmount: number;
        newBalance: number;
        symbols: string[][];
      },
    },
    ERROR: {
      name: "error",
      payload: {} as {
        message: string;
        code?: string;
      },
    },
  },
} as const;

// Helper types
type EventMap = typeof Events;
export type ClientEvent = keyof EventMap["CLIENT"];
export type ServerEvent = keyof EventMap["SERVER"];
