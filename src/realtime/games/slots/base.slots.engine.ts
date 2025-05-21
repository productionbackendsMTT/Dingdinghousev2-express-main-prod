import { GameEngine } from "../game.engine";
import { SlotsInitData } from "../game.type";
import {
  SlotAction,
  SlotConfig,
  SlotResponse,
  specialIcons,
} from "./base.slots.type";

class BaseSlotsEngine extends GameEngine<
  SlotConfig,
  SlotAction,
  SlotResponse,
  SlotsInitData
> {
  validateConfig(): void {
    const { matrix, lines, symbols } = this.config.content;
    console.log("Validating config...");
  }

  async handleAction(action: SlotAction): Promise<SlotResponse> {
    switch (action.type) {
      case "spin":
        return this.handleSpin(action);
      default:
        throw new Error(`Unknown action: ${action.type}`);
    }
  }

  public async getInitData(userId: string): Promise<SlotsInitData> {
    const balance = await this.state.getBalance(userId, this.config.gameId);

    return {
      id: "initData",
      gameData: {
        lines: this.config.content.lines,
        bets: this.config.content.bets,
      },
      uiData: {
        paylines: {
          symbols: this.config.content.symbols.map((symbol) => ({
            id: symbol.id,
            name: symbol.name,
            multiplier: symbol.multiplier,
            description: symbol.description,
          })),
        },
      },
      player: {
        balance,
      },
    };
  }

  protected async handleSpin(action: SlotAction): Promise<SlotResponse> {
    try {
      const { userId, payload } = action;

      if (payload.betAmount > this.config.content.bets.length - 1) {
        throw new Error("Invalid bet amount");
      }

      if (this.config.content.bets[payload.betAmount] <= 0) {
        throw new Error("Something went wrong");
      }

      const betAmount =
        this.config.content.bets[payload.betAmount] *
        this.config.content.lines.length;

      const balance = await this.state.getBalance(userId, this.config.gameId);
      if (balance < betAmount) {
        throw new Error("Balance is low");
      }

      await this.state.deductBalanceWithDbSync(userId, this.config.gameId, betAmount);

      const reels = this.getRandomMatrix();
      const specialSymbolsResult = this.checkForSpecialSymbols(reels);
      const lineWins = this.checkLines(reels);

      const totalWinAmount = this.accumulateWins(lineWins) +
        (specialSymbolsResult.reduce((sum, symbol) => sum + (symbol.specialWin || 0), 0));



      await this.state.creditBalanceWithDbSync(userId, this.config.gameId, totalWinAmount * payload.betAmount)

      const newBalance = await this.state.getBalance(userId, this.config.gameId);



      const features = specialSymbolsResult
        .filter(symbol => symbol.specialWin || symbol.freeSpinCount)
        .map(symbol => ({
          type: specialIcons[symbol.symbol as keyof typeof specialIcons],
          data: {
            count: symbol.count,
            winAmount: symbol.specialWin,
            ...(symbol.freeSpinCount ? { freeSpins: symbol.freeSpinCount } : {})
          }
        }));

      const spinResult = {
        id: "ResultData",
        payload: {
          winAmount: totalWinAmount,
          wins: lineWins.map(win => {
            const lineIndex = win.line[0] - 1;
            const winningSymbolsInfo = this.getWinningSymbolsInfo(win.symbols, lineIndex);
            return {
              line: lineIndex,
              positions: winningSymbolsInfo.positions,
              amount: win.amount
            };
          }),
          ...(features.length > 0 ? { features } : {})
        }
      };

      return {
        success: true,
        matrix: reels,
        ...spinResult,
        player: {
          balance: newBalance,
        },
      };

    } catch (error) {
      console.error(`Error processing spin for user`, error);
      throw error;
    }
  }
  protected getWinningSymbolsInfo(symbols: string[], lineIndex: number): {
    symbols: string[],
    positions: number[]
  } {
    const lineDefinition = this.config.content.lines[lineIndex];
    const wildSymbol = this.config.content.symbols
      .find(s => s.name === "Wild")?.id.toString();

    // Determine the paying symbol (first non-wild or first symbol)
    let paySymbol = symbols.find(s => s !== wildSymbol) || symbols[0];

    // Find all consecutive matching symbols (including wilds)
    const winningSymbols: string[] = [];
    const winningPositions: number[] = [];

    for (let i = 0; i < symbols.length; i++) {
      if (symbols[i] === paySymbol || symbols[i] === wildSymbol) {
        winningSymbols.push(symbols[i]);
        winningPositions.push(i); // The position in the line (0-4)
      } else {
        break; // Stop at first non-matching symbol
      }
    }

    return {
      symbols: winningSymbols,
      positions: winningPositions
    };
  }
  protected generateReels(): string[][] {
    // Base implementation - override in variants
    return [];
  }

  protected evaluateWins(reels: string[][], bet: SlotAction["payload"]) {
    // Base implementation - override in variants
    return { total: 0, lines: [] };
  }

  protected checkFeatures(reels: string[][]) {
    // Base implementation - override in variants
    return [];
  }

  protected shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  protected getRandomMatrix(): string[][] {
    const matrix: string[][] = [];
    const resultMatrix: string[][] = [];

    // First create and shuffle the full reels
    for (let i = 0; i < this.config.content.matrix.x; i++) {
      const row: string[] = [];

      // Fill row with symbols based on reelsInstance
      this.config.content.symbols.forEach((symbol) => {
        for (let j = 0; j < symbol.reelsInstance[i]; j++) {
          row.push(symbol.id.toString());
        }
      });

      // Shuffle the row before adding to matrix
      const shuffledRow = this.shuffleArray([...row]);
      matrix.push(shuffledRow);
    }

    // Now get random visible segments from each reel
    for (let i = 0; i < matrix.length; i++) {
      const reel = matrix[i];
      const visibleSymbols: string[] = [];

      // Get random starting index
      const startIdx = Math.floor(
        Math.random() * (reel.length - this.config.content.matrix.y)
      );

      // Get Y consecutive symbols from the random starting point
      for (let j = 0; j < this.config.content.matrix.y; j++) {
        visibleSymbols.push(reel[(startIdx + j) % reel.length]);
      }

      resultMatrix.push(visibleSymbols);
    }

    return resultMatrix[0].map((_, colIndex) =>
      matrix.map((row) => row[colIndex])
    );
  }
  protected checkLines(matrix: string[][]): Array<{
    line: number[];
    symbols: string[];
    amount: number;
  }> {
    const results: Array<{
      line: number[];
      symbols: string[];
      amount: number;
    }> = [];

    this.config.content.lines.forEach((line, lineIndex) => {
      const values = line.map(
        (rowIndex, colIndex) => matrix[rowIndex][colIndex]
      );

      const lineResult = this.checkLineSymbols(values, line);
      if (lineResult.count >= 3) {
        results.push({
          line: [lineIndex + 1],
          symbols: values,
          amount: lineResult.win,
        });
      }
    });

    return results;
  }

  protected checkLineSymbols(
    values: string[],
    line: number[]
  ): {
    count: number;
    win: number;
  } {
    let count = 1;
    let paySymbol: string | null = null;
    const wins: Array<{ line: number[]; symbols: string[]; amount: number }> =
      [];
    const wildSymbol = this.config.content.symbols
      .find((s) => s.name === "Wild")
      ?.id.toString();

    if (values[0] === wildSymbol) {
      for (let i = 1; i < values.length; i++) {
        if (values[i] !== wildSymbol) {
          const symbol = this.config.content.symbols.find(
            (s) => s.id.toString() === values[i] && s.useWildSub
          );
          if (symbol) {
            paySymbol = values[i];
            count = i + 1;
            break;
          }
        }
        count++;
      }
    } else {
      const firstSymbol = this.config.content.symbols.find(
        (s) => s.id.toString() === values[0]
      );
      if (!firstSymbol?.useWildSub) {
        return { count: 0, win: 0 };
      }
    }
    paySymbol = paySymbol || values[0];

    if (!paySymbol) {
      return { count: 0, win: 0 };
    }

    for (let i = count; i < values.length; i++) {
      if (values[i] === paySymbol) {
        count++;
      } else if (values[i] === wildSymbol) {
        count++;
      } else {
        const symbol = this.config.content.symbols.find(
          (s) => s.id.toString() === values[i]
        );
        if (!symbol?.useWildSub) {
          break;
        }
        break;
      }
    }
    const symbol = this.config.content.symbols.find(
      (s) => s.id.toString() === paySymbol
    );
    const winAmount =
      symbol && count >= 3
        ? symbol.multiplier[this.config.content.matrix.x - count] || 0
        : 0;
    if (winAmount > 0) {
      wins.push({
        line: [line[0]],
        symbols: values.slice(0, count),
        amount: winAmount,
      });
    }
    const result = this.accumulateWins(wins);
    return {
      count,
      win: result,
    };
  }

  protected checkForSpecialSymbols(matrix: string[][]): Array<{
    symbol: string;
    symbolName: string;
    count: number;
    specialWin?: number;
    freeSpinCount?: number;
  }> {
    const specialSymbols: Array<{
      symbol: string;
      symbolName: string;
      count: number;
      specialWin?: number;
      freeSpinCount?: number;
    }> = [];

    const specialSymbolsData = this.config.content.symbols
      .filter((symbol) => symbol.useWildSub === false && symbol.enabled)
      .map((symbol) => ({
        id: symbol.id.toString(),
        name: symbol.name,
        minSymbolCount: symbol.minSymbolCount,
        multiplier: symbol.multiplier,
        defaultAmount: symbol.defaultAmount,
      }));

    // Count special symbols
    matrix.flat().forEach((symbolId) => {
      const symbolData = specialSymbolsData.find((s) => s.id === symbolId);
      if (symbolData) {
        const existing = specialSymbols.find((s) => s.symbol === symbolId);
        if (existing) {
          existing.count++;
        } else {
          specialSymbols.push({
            symbol: symbolId,
            symbolName: symbolData.name,
            count: 1,
            specialWin: 0,
            freeSpinCount: 0,
          });
        }
      }
    });

    specialSymbols.forEach((specialSymbol) => {
      const symbolConfig = specialSymbolsData.find(
        (s) => s.id === specialSymbol.symbol
      );
      if (
        symbolConfig &&
        specialSymbol.count >= (symbolConfig.minSymbolCount ?? 0)
      ) {
        switch (
        specialIcons[specialSymbol.symbol as keyof typeof specialIcons]
        ) {
          case specialIcons.scatter:
            const scatterWins = [
              {
                line: [],
                symbols: Array(specialSymbol.count).fill(specialSymbol.symbol),
                amount:
                  symbolConfig.multiplier[
                  specialSymbol.count - (symbolConfig.minSymbolCount ?? 0)
                  ] || 0,
              },
            ];
            specialSymbol.specialWin = this.accumulateWins(scatterWins);
            break;

          case specialIcons.jackpot:
            if (specialSymbol.count >= (symbolConfig.minSymbolCount ?? 0)) {
              console.log(
                "jackpot",
                specialSymbol.count,
                symbolConfig.minSymbolCount
              );
              const jackpotWins = [
                {
                  line: [],
                  symbols: Array(5).fill(specialSymbol.symbol),
                  amount: symbolConfig.defaultAmount || 0,
                },
              ];

              console.log(jackpotWins);
              specialSymbol.specialWin = this.accumulateWins(jackpotWins);
            }
            break;

          case specialIcons.FreeSpin:
            const multiplierIndex =
              specialSymbol.count - (symbolConfig.minSymbolCount ?? 0);
            if (multiplierIndex >= 0) {
              specialSymbol.freeSpinCount =
                symbolConfig.multiplier[multiplierIndex];
              const freeSpinWins = [
                {
                  line: [],
                  symbols: Array(specialSymbol.count).fill(
                    specialSymbol.symbol
                  ),
                  amount: symbolConfig.multiplier[multiplierIndex] || 0,
                },
              ];
              specialSymbol.specialWin = this.accumulateWins(freeSpinWins);
            }
            break;
        }
      }
    });

    return specialSymbols;
  }

  protected accumulateWins(
    wins: Array<{ line: number[]; symbols: string[]; amount: number }>
  ) {
    const totalWin = wins.reduce((acc, win) => acc + win.amount, 0);
    return totalWin;
  }
}

export default BaseSlotsEngine;
