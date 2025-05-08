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

  protected checkLines(matrix: string[][]) {
    const lines = this.config.content.lines;

    for (const line of lines) {
      // Extracting values
      const values = line.map(
        (rowIndex, colIndex) => matrix[rowIndex][colIndex]
      );

      this.checkLinesSymbols(values);

      let count = 1;

      for (let i = 1; i < values.length; i++) {
        if (values[i] === values[0]) {
          count++;
        } else {
          break;
        }
      }

      if (count >= 3) {
        console.log(
          `Line ${line} starts with ${values[0]} repeated ${count} times.`
        );
      }
    }
  }

  protected checkLinesSymbols(matched: string[]) {
    let firstSymbol: string | null = null;
    let count = 0;

    for (const symbolId of matched) {
      const symbol = this.config.content.symbols.find(
        (s) => s.id.toString() === symbolId
      );

      if (!symbol) break;

      if (!symbol.useWildSub) {
        break;
      }

      if (symbol.name === "Wild") {
        count++;
      } else if (firstSymbol === null) {
        firstSymbol = symbolId;
        count++;
      } else if (symbolId === firstSymbol) {
        count++;
      } else {
        break;
      }
    }

    console.log("COUNT : ", count);
  }
}

export default BaseSlotsEngine;

// def evaluate_lines(result_matrix, lines_api_data, symbols, total_bet):
//     total_payout = 0
//     winning_paylines = []

//     for line in lines_api_data:
//         matched_symbols = [result_matrix[line[i]][i] for i in range(5)]

//         first_symbol = None
//         count = 0

//         for symbol in matched_symbols:
//             if symbols[symbol]['useWildSub'] == 'False':
//                 break
//             if symbols[symbol]['Name'] == 'Wild':
//                 count += 1
//             elif first_symbol is None:
//                 first_symbol = symbol
//                 count += 1
//             elif symbol == first_symbol:
//                 count += 1
//             else:
//                 break
