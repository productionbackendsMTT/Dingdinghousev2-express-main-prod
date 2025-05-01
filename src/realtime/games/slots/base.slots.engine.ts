import { number, symbol } from "zod";
import { IGame } from "../../../common/types/game.type";
import { IPayout } from "../../../common/types/payout.type";
import { GameEngine } from "../game.engine";
import { SlotGameConfig, specialIcons } from "../game.type";
import { functionUsedConfig, SlotConfig } from "./base.slots.type";
import { shuffleArray } from "./gameUtils.slots";
import { RandomResultGenerator } from "./randommatrix.slots.generator";
import { log } from "console";

class BaseSlotsEngine extends GameEngine<SlotGameConfig> {
  protected slotConfig: SlotConfig;
  protected functionConfig!: functionUsedConfig;
  constructor(game: IGame & { payout: IPayout }) {
    super(game);
    this.slotConfig = this.config.content;
    this.functionConfig = {
      reels: [],
      resultReelIndex: [],
      resultSymbolMatrix: [],
    };
    this.generateInitReel()
    this.spin()
    this.checkWin()
  }

  protected validateConfig(): void { }
  /**
   * Initializes the slot machine by generating the initial reel configuration and spinning the reels.
   * @returns {Promise<void>}
   */
  public async init(): Promise<void> {

  }
  /**
   * Generates the initial reel configuration based on the slot configuration.
   * @returns {Promise<void>}
   */
  protected async generateInitReel(): Promise<void> {
    try {
      // Validate slot configuration
      if (!this.slotConfig || !this.slotConfig.matrix || !this.slotConfig.symbols) {
        throw new Error(`Invalid slot configuration for ${this.slotConfig.tag}.`);
      }
      const matrix = Array.from({ length: this.slotConfig.matrix.x }, (_, i) => {
        const reel = this.slotConfig.symbols.flatMap((symbol) =>
          Array(symbol.reelsInstance[i]).fill(symbol.id.toString())
        );
        shuffleArray(reel);
        return reel;
      });
      this.functionConfig.reels = matrix
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error generating initial reel: ${error.message}`);
      }
      throw new Error('An unknown error occurred while generating the initial reel.');

    }
  }
  /**
   * Spins the slot machine and generates a random result.
   * @returns {Promise<void>}
   */
  protected async spin(): Promise<void> {
    console.log(`Spinning the slot ${this.slotConfig.tag} ... `);
    new RandomResultGenerator(this.slotConfig, this.functionConfig)
  }
  /**
   * Checks if the player has won based on the current reel configuration and paylines.
   * @returns {Promise<void>}
   */
  protected async checkWin(): Promise<void> {
    console.log(`Checking for wins on slot ${this.slotConfig.tag} ... `);
    try {
      const winningLines = [];
      let payout = 0;

      for (const [index, line] of this.slotConfig.lines.entries()) {

        const veryFirstSymbolPos = line[0];

        let veryFirstSymbol = this.functionConfig.resultSymbolMatrix?.[veryFirstSymbolPos]?.[0] ?? null;

        if (this.slotConfig.symbols.some(symbol => symbol.useWildSub) && veryFirstSymbol === this.slotConfig.symbols.find(symbol => symbol.name == specialIcons.wild)?.id.toString()) {
          veryFirstSymbol = (await this.findFirstNonWildSymbol(line)) ?? null;
          console.log(`Found first non-wild symbol: ${veryFirstSymbol}`);
        }

        if (veryFirstSymbol === null) {
          console.warn('Skipping line check as veryFirstSymbol is null.');
          return
        }
        const { isWinningLine, matchCount, matchedIndices } = await this.checkLineSymbols(veryFirstSymbol, line);

        if (isWinningLine && matchCount >= 3) {
          const symbolMultiplier = (await this.accumulateMultiplier(veryFirstSymbol, matchCount));

          if (symbolMultiplier !== null && symbolMultiplier > 0) {
            payout += symbolMultiplier;
            console.log(`Line ${index + 1}:`, line);
            console.log(`Payout for Line ${index + 1}:`, 'payout', symbolMultiplier);
          }
        }

      }





    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error checking win: ${error.message}`);
      }
      throw new Error('An unknown error occurred while checking win.');
    }
  }
  /**
   * Finds the first non-wild symbol in a given line.
   * @param {number[]} line - The line to check for non-wild symbols.
   * @returns {Promise<string | null>} - The first non-wild symbol or null if not found.
   */
  private async findFirstNonWildSymbol(line: number[]): Promise<string | null> {
    try {
      const wildSymbol = this.slotConfig.symbols.find(symbol => symbol.name == specialIcons.wild)?.id.toString();
      for (let i = 0; i < line.length; i++) {
        const rowIndex = line[i];
        const symbol = this.functionConfig.resultSymbolMatrix?.[rowIndex]?.[i] ?? null;
        if (symbol !== wildSymbol) {
          return symbol;
        }
      }
      return wildSymbol ?? null;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error finding first non-wild symbol: ${error.message}`);
      }
      throw new Error('An unknown error occurred while finding first non-wild symbol.');
    }
  }
  /**
   * Checks if a line of symbols is a winning line.
   * @param {string} veryFirstSymbol - The first symbol in the line.
   * @param {number[]} line - The line to check.
   * @returns {Promise<{ isWinningLine: boolean, matchCount: number, matchedIndices: { col: number, row: number }[] }>} - The result of the check.
   */
  private async checkLineSymbols(veryFirstSymbol: string, line: number[]): Promise<{
    isWinningLine: boolean, matchCount: number, matchedIndices: { col: number, row: number }[]
  }> {
    const wildSymbol = this.slotConfig.symbols.find(symbol => symbol.name == specialIcons.wild)?.id.toString() || "";
    let matchCount = 1;
    let currentSymbol = veryFirstSymbol;
    const matchedIndices: { col: number, row: number }[] = [{ col: 0, row: line[0] }];

    for (let i = 1; i < line.length; i++) {
      const rowIndex = line[i];
      const symbol = this.functionConfig.resultSymbolMatrix?.[rowIndex]?.[i] ?? null;
      if (symbol === undefined) {
        console.error(`Symbol at position [${rowIndex}, ${i}] is undefined.`);
        return { isWinningLine: false, matchCount: 0, matchedIndices: [] };
      }

      if (symbol === currentSymbol || symbol === wildSymbol) {
        matchCount++;
        matchedIndices.push({ col: i, row: rowIndex });
      } else if (currentSymbol === wildSymbol) {
        if (symbol !== null) {
          currentSymbol = symbol;
        }
        matchCount++;
        matchedIndices.push({ col: i, row: rowIndex });
      } else {
        break;
      }
    }

    return { isWinningLine: matchCount >= 3, matchCount, matchedIndices };
  }
  /**
   * Accumulates the multiplier based on the matched symbols.
   * @param {string} veryFirstSymbol - The first symbol in the line.
   * @param {number} matchCount - The number of matching symbols.
   * @returns {Promise<number>} - The accumulated multiplier.
   */
  private async accumulateMultiplier(veryFirstSymbol: string, matchCount: number): Promise<number | null> {
    try {
      const symbolData = this.slotConfig.symbols.find(s => s.id.toString() === veryFirstSymbol);
      if (!symbolData) {
        console.warn(`No symbol data found for symbol: ${veryFirstSymbol}`);
        return null;
      }
      console.log(`Symbol data found for symbol: ${veryFirstSymbol}`, symbolData);
      const multiplierArray = symbolData.multiplier;
      if (!multiplierArray) {
        console.warn(`No multiplier array found for symbol: ${veryFirstSymbol}`);
        return null;
      }

      const index = this.slotConfig.matrix.x - matchCount;
      const multiplierValue = multiplierArray[index];

      if (Array.isArray(multiplierValue)) {
        return multiplierValue[0];
      } else if (typeof multiplierValue === 'number') {
        return multiplierValue;
      } else {
        console.warn(`Invalid multiplier value structure for symbol: ${veryFirstSymbol}`);
        return null;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error accumulating multiplier: ${error.message}`);
      }
      throw new Error('An unknown error occurred while accumulating multiplier.');
    }
  }


}

export default BaseSlotsEngine;
