import { GameEngine } from "../game.engine";
import { SlotAction, SlotConfig, SlotResponse } from "./base.slots.type";

class BaseSlotsEngine extends GameEngine<SlotConfig, SlotAction, SlotResponse> {
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

  protected async handleSpin(action: SlotAction): Promise<SlotResponse> {
    const { userId, payload } = action;
    const lockKey = `lock:player:${userId}:game:${this.config.gameId}:spin`;

    const matrix = this.getRandomMatrix();
    const lines = this.checkLines(matrix);

    console.log(`Attempting to acquire spin lock for ${lockKey}`);

    // Remove the withLock wrapper since StateService will handle its own locking
    try {
      // Validate balance and deduct bet
      const balance = await this.state.getBalance(userId, this.config.gameId);
      const totalBet = payload.betAmount * payload.lines;

      if (balance < totalBet) {
        console.log(
          `Insufficient balance for user ${userId}. Balance: ${balance}, Bet: ${totalBet}`
        );
        return {
          success: false,
          balance,
          error: "Insufficient balance",
          reels: [],
          winAmount: 0,
          wins: [],
        };
      }

      // Deduct bet amount
      await this.state.deductBalance(userId, this.config.gameId, totalBet);
      console.log(`Deducted ${totalBet} from user ${userId}'s balance`);

      // Generate spin result
      const result = await this.generateSpinResult(payload);
      console.log(`Spin result generated for user ${userId}`);

      // Credit wins if any
      if (result.winAmount && result.winAmount > 0) {
        await this.state.creditBalance(
          userId,
          this.config.gameId,
          result.winAmount
        );
        console.log(`Credited ${result.winAmount} to user ${userId}'s balance`);
      }

      // Get final balance
      const finalBalance = await this.state.getBalance(
        userId,
        this.config.gameId
      );

      return {
        success: true,
        balance: finalBalance,
        reels: result.reels || [],
        winAmount: result.winAmount || 0,
        wins: result.wins || [],
        features: result.features,
      };
    } catch (error) {
      console.error(`Error processing spin for user ${userId}:`, error);
      throw error;
    }
  }

  protected async generateSpinResult(
    bet: SlotAction["payload"]
  ): Promise<Partial<SlotResponse>> {
    const reels = this.generateReels();
    const wins = this.evaluateWins(reels, bet);
    const features = this.checkFeatures(reels);

    return {
      reels,
      winAmount: wins.total,
      wins: wins.lines,
      features,
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
      const values = line.map((rowIndex, colIndex) => matrix[rowIndex][colIndex]);

      const lineResult = this.checkLineSymbols(values, line);
      if (lineResult.count >= 3) {
        results.push({
          line: [lineIndex + 1],
          symbols: values,
          amount: lineResult.win
        });
      }
    });

    return results;
  }

  protected checkLineSymbols(values: string[], line: number[]): {
    count: number;
    win: number;
  } {
    let count = 1;
    let paySymbol: string | null = null;

    const wildSymbol = this.config.content.symbols.find(s => s.name === "Wild")?.id.toString();

    if (values[0] === wildSymbol) {
      for (let i = 1; i < values.length; i++) {
        if (values[i] !== wildSymbol) {
          const symbol = this.config.content.symbols.find(s =>
            s.id.toString() === values[i] && s.useWildSub
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
      const firstSymbol = this.config.content.symbols.find(s =>
        s.id.toString() === values[0]
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
        const symbol = this.config.content.symbols.find(s =>
          s.id.toString() === values[i]
        );
        if (!symbol?.useWildSub) {
          break;
        }
        break;
      }

    }
    const symbol = this.config.content.symbols.find(s => s.id.toString() === paySymbol);
    const winAmount = symbol && count >= 3 ? (symbol.multiplier[this.config.content.matrix.x - count] || 0) : 0;

    return {
      count,
      win: winAmount
    };
  }

}

export default BaseSlotsEngine;

