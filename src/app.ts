import express, { Request, Response } from 'express';
import { createServer } from 'http';
import os from 'os';
import moduleRoutes from './modules';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { GameFactory } from './(Slots)/core/game-factory';
import errorHandler from './common/middlewares/error.middleware';
import { GameConfig } from './(Slots)/utils/GameConfig';
import { BaseSlotGame } from './(Slots)/core/base.slot';

// Initialize Express app
const app = express();

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ['http://localhost:3000', 'https://yourdomain.com'], // Allow specific origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true, // Allow credentials (cookies, authorization headers)
    maxAge: 86400, // Cache preflight requests for 1 day
  })
);

// Default game configuration
const defaultGameConfig: GameConfig = {
  "id": "SL-CM",
  "matrix": {
      "x": 5,
      "y": 3
  },
  "linesApiData": [
      [
          1,
          1,
          1,
          1,
          1
      ],
      [
          0,
          0,
          0,
          0,
          0
      ],
      [
          2,
          2,
          2,
          2,
          2
      ],
      [
          0,
          1,
          2,
          1,
          0
      ],
      [
          2,
          1,
          0,
          1,
          2
      ],
      [
          1,
          0,
          1,
          0,
          1
      ],
      [
          1,
          2,
          1,
          2,
          1
      ],
      [
          0,
          0,
          1,
          2,
          2
      ],
      [
          2,
          2,
          1,
          0,
          0
      ],
      [
          1,
          2,
          1,
          0,
          1
      ],
      [
          1,
          0,
          1,
          2,
          1
      ],
      [
          0,
          1,
          1,
          1,
          0
      ],
      [
          2,
          1,
          1,
          1,
          2
      ],
      [
          0,
          1,
          0,
          1,
          0
      ],
      [
          2,
          1,
          2,
          1,
          2
      ],
      [
          1,
          1,
          0,
          1,
          1
      ],
      [
          1,
          1,
          2,
          1,
          1
      ],
      [
          0,
          0,
          2,
          0,
          0
      ],
      [
          2,
          2,
          0,
          2,
          2
      ],
      [
          0,
          2,
          2,
          2,
          0
      ]
  ],
  "linesCount": [
      1,
      5,
      15,
      20
  ],
  "bets": [
      0.0005,
      0.0025,
      0.005,
      0.0125,
      0.025,
      0.0375,
      0.05,
      0.0625,
      0.1,
      0.15,
      0.25,
      0.5,
      0.75,
      1,
      1.5,
      2
  ],
  "bonus": {
      "type": "spin",
      "isEnabled": true,
      "noOfItem": 8,
      "payOut": [
          200,
          100,
          70,
          50,
          30,
          20,
          15,
          10
      ],
      "payOutProb": [
          0.05,
          0.5,
          1,
          3,
          10,
          20,
          25,
          39.4
      ]
  },
  "gamble": {
      "type": "card",
      "isEnabled": false
  },
  "Symbols": [
      {
          "Name": "0",
          "Id": 0,
          "reelInstance": {
              "0": 10,
              "1": 10,
              "2": 10,
              "3": 10,
              "4": 10
          },
          "useWildSub": true,
          "multiplier": [
              [
                  50,
                  0
              ],
              [
                  30,
                  0
              ],
              [
                  10,
                  0
              ]
          ]
      },
      {
          "Name": "1",
          "Id": 1,
          "reelInstance": {
              "0": 10,
              "1": 10,
              "2": 10,
              "3": 10,
              "4": 10
          },
          "useWildSub": true,
          "multiplier": [
              [
                  50,
                  0
              ],
              [
                  30,
                  0
              ],
              [
                  10,
                  0
              ]
          ]
      },
      {
          "Name": "2",
          "Id": 2,
          "reelInstance": {
              "0": 10,
              "1": 10,
              "2": 10,
              "3": 10,
              "4": 10
          },
          "useWildSub": true,
          "multiplier": [
              [
                  50,
                  0
              ],
              [
                  30,
                  0
              ],
              [
                  10,
                  0
              ]
          ]
      },
      {
          "Name": "3",
          "Id": 3,
          "reelInstance": {
              "0": 10,
              "1": 10,
              "2": 10,
              "3": 10,
              "4": 10
          },
          "useWildSub": true,
          "multiplier": [
              [
                  50,
                  0
              ],
              [
                  30,
                  0
              ],
              [
                  10,
                  0
              ]
          ]
      },
      {
          "Name": "4",
          "Id": 4,
          "reelInstance": {
              "0": 10,
              "1": 10,
              "2": 10,
              "3": 10,
              "4": 10
          },
          "useWildSub": true,
          "multiplier": [
              [
                  50,
                  0
              ],
              [
                  30,
                  0
              ],
              [
                  10,
                  0
              ]
          ]
      },
      {
          "Name": "5",
          "Id": 5,
          "reelInstance": {
              "0": 4,
              "1": 4,
              "2": 4,
              "3": 4,
              "4": 4
          },
          "useWildSub": true,
          "multiplier": [
              [
                  80,
                  0
              ],
              [
                  60,
                  0
              ],
              [
                  15,
                  0
              ]
          ]
      },
      {
          "Name": "6",
          "Id": 6,
          "reelInstance": {
              "0": 4,
              "1": 4,
              "2": 4,
              "3": 4,
              "4": 4
          },
          "useWildSub": true,
          "multiplier": [
              [
                  80,
                  0
              ],
              [
                  60,
                  0
              ],
              [
                  15,
                  0
              ]
          ]
      },
      {
          "Name": "7",
          "Id": 7,
          "reelInstance": {
              "0": 4,
              "1": 4,
              "2": 4,
              "3": 4,
              "4": 4
          },
          "useWildSub": true,
          "multiplier": [
              [
                  80,
                  0
              ],
              [
                  60,
                  0
              ],
              [
                  15,
                  0
              ]
          ]
      },
      {
          "Name": "8",
          "Id": 8,
          "reelInstance": {
              "0": 4,
              "1": 4,
              "2": 4,
              "3": 4,
              "4": 4
          },
          "useWildSub": true,
          "multiplier": [
              [
                  80,
                  0
              ],
              [
                  60,
                  0
              ],
              [
                  15,
                  0
              ]
          ]
      },
      {
          "Name": "FreeSpin",
          "Id": 9,
          "reelInstance": {
              "0": 3,
              "1": 3,
              "2": 3,
              "3": 3,
              "4": 3
          },
          "description": "Activates 3, 5, or 10 free spins when 3, 4, or 5 symbols appear anywhere on the result matrix.",
          "useWildSub": false,
          "multiplier": [
              [
                  0,
                  10
              ],
              [
                  0,
                  5
              ],
              [
                  0,
                  3
              ]
          ]
      },
      {
          "Name": "Wild",
          "Id": 10,
          "reelInstance": {
              "0": 7,
              "1": 7,
              "2": 7,
              "3": 7,
              "4": 7
          },
          "description": "Substitutes for all symbols except Jackpot, Free Spin, Bonus, and Scatter.",
          "useWildSub": false,
          "multiplier": []
      },
      {
          "Name": "Scatter",
          "Id": 11,
          "reelInstance": {
              "0": 2,
              "1": 2,
              "2": 2,
              "3": 2,
              "4": 2
          },
          "description": "Scatter: Offers higher pay outs when 3 or more symbols appear anywhere on the result matrix. Payout: 5x - 1000, 4x - 700, 3x - 500",
          "useWildSub": false,
          "multiplier": [
              [
                  1000,
                  0
              ],
              [
                  700,
                  0
              ],
              [
                  500,
                  0
              ]
          ]
      },
      {
          "Name": "Jackpot",
          "Id": 12,
          "reelInstance": {
              "0": 1,
              "1": 1,
              "2": 1,
              "3": 1,
              "4": 1
          },
          "description": "Mega win triggered by 5 Jackpot symbols appearing anywhere on the result matrix. Payout: 5000x",
          "useWildSub": false,
          "multiplier": [],
          "defaultAmount": 5000,
          "symbolsCount": 5,
          "increaseValue": 5
      },
      {
          "Name": "Bonus",
          "Id": 13,
          "reelInstance": {
              "0": 3,
              "1": 3,
              "2": 3,
              "3": 3,
              "4": 3
          },
          "description": "Starts a spinning wheel game for a pay out when 3 or more symbols appear anywhere on the result matrix.",
          "useWildSub": false,
          "symbolCount": 3,
          "multiplier":[]
      }
  ]
}

// Initialize currentGame as a placeholder
let currentGame: BaseSlotGame;

(async () => {
  currentGame = await GameFactory.create(defaultGameConfig);
})();

// Basic server status route
app.get('/', (req: Request, res: Response) => {
  const response = {
    uptime: os.uptime(),
    timestamp: new Date().toISOString(),
    message: 'Server is running',
  };
  res.json(response);
});

// Render game page
app.get('/game', (req: Request, res: Response) => {
  res.render('game', { game: currentGame });
});

// Spin route
app.get('/game/spin', (req: Request, res: Response) => {
  currentGame.spin();
  res.send('Spin executed successfully!');
});

// Evaluate result route
app.get('/game/evaluate', (req: Request, res: Response) => {
  const resultMatrix: number[][] = [];
  currentGame.evaluateResult(resultMatrix);
  res.send('Result evaluated successfully!');
});

// API routes
app.use('/api', moduleRoutes);

// Global error handler middleware
app.use(errorHandler);

// Export server
export const server = createServer(app);
