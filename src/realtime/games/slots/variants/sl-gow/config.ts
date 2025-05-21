// src/modules/games/god-of-wealth/config.ts
import { z } from "zod";
import { GameDefinition } from "./type";
import { staticData } from "./config.demo";

const symbolSchema = z.object({
  Name: z.string(),
  Id: z.number(),
  reelInstance: z.record(z.string(), z.number()),
  useWildSub: z.boolean(),
  multiplier: z.array(z.array(z.number())).optional(),
  description: z.string().optional(),
});

const gameDefinitionSchema = z.object({
  id: z.string(),
  matrix: z.object({ x: z.number(), y: z.number() }),
  bets: z.array(z.number()),
  paylines: z.array(z.array(z.number())),
  featureAllMult: z.array(z.number()),
  freeSpinConfig: z.object({
    goldColCountProb: z.array(z.number()),
    goldColProb: z.array(z.number()),
  }),
  Symbols: z.array(symbolSchema),
});

// Validate the game definition
const parsedResult = gameDefinitionSchema.safeParse(JSON.parse(staticData));

if (!parsedResult.success) {
  throw new Error(`Validation failed: ${parsedResult.error}`);
}

export const gameDefinition: GameDefinition = parsedResult.data;
