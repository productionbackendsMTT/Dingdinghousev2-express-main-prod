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
    GAMBLE_REQUEST: {
      name: "gamble:request",
      payload: {} as {
        type: "BLACKRED"
        lastWinning?: number;
        cardType?: string
        event: string
      }
    },

    FREESPIN_REQUEST: {
      name: "freespin:request",
      payload: {} as {
        type: "FREESPINOPTION"
        option: number
      }
    },
    CONFIG_UPDATE: {
      name: "game:config:update",
      payload: {} as {
        gameId: string;
        name: string;
        content: any;
        version: number;
        tag: string;
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
    GAMBLE_RESULT: {
      name: "gamble:result",
      payload: {} as {
        success: boolean;
        balance: number;
        winAmount: number;
      }
    },
    INIT_DATA: {
      name: "game:init",
      payload: {} as {},
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
