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

    const matrix = this.getRandomMatrix();
    console.log("Generated matrix:", matrix);

    const lines = this.checkLines(matrix);
    console.log("Lines:", lines);

    return this.state.withLock(
      `spin:${userId}:${this.config.gameId}`,
      async () => {
        // Validate balance and deduct bet
        const balance = await this.state.getBalance(userId, this.config.gameId);
        const totalBet = payload.betAmount * payload.lines;

        if (balance < totalBet) {
          return {
            success: false,
            balance,
            error: "Insufficient balance",
            // Add required properties even for error case
            reels: [],
            winAmount: 0,
            wins: [],
          };
        }

        // Deduct bet amount
        await this.state.deductBalance(userId, this.config.gameId, totalBet);

        // Generate spin result
        const result = await this.generateSpinResult(payload);

        // Credit wins if any
        if (result.winAmount && result.winAmount > 0) {
          await this.state.creditBalance(
            userId,
            this.config.gameId,
            result.winAmount
          );
        }

        // Get final balance
        const finalBalance = await this.state.getBalance(
          userId,
          this.config.gameId
        );

        // Ensure all required properties are included
        return {
          success: true,
          balance: finalBalance,
          reels: result.reels || [],
          winAmount: result.winAmount || 0,
          wins: result.wins || [],
          features: result.features,
        };
      }
    );
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
    count: number;
    win: number;
  }> {
    const lines = this.config.content.lines;
    const results = [];

    for (const line of lines) {
      // Extract symbols for this line
      const values = line.map(
        (rowIndex, colIndex) => matrix[rowIndex][colIndex]
      );

      const lineResult = this.checkLineSymbols(values, line);
      if (lineResult.count >= 3) {
        results.push(lineResult);
      }
    }

    return results;
  }

  private checkLineSymbols(values: string[], line: number[]): {
    line: number[];
    symbols: string[];
    count: number;
    win: number;
  } {
    let count = 1;
    let paySymbol: string | undefined = undefined;
    const wildSymbol = this.config.content.symbols.find(
      (symbol) => symbol.name === "Wild"
    )?.id.toString();

    // Handle first position
    if (values[0] === wildSymbol) {
      // If first is wild, look for next non-wild symbol
      for (let i = 1; i < values.length; i++) {
        if (values[i] !== wildSymbol) {
          paySymbol = values[i];
          count = i + 1; 
          break;
        }
        count++;
      }
      // If all symbols are wild
      if (!paySymbol) {
        paySymbol = wildSymbol;
      }
    } else {
      paySymbol = values[0];
    }

    // Check remaining positions
    for (let i = count; i < values.length; i++) {
      if (values[i] === paySymbol || values[i] === wildSymbol) {
        count++;
      } else {
        break;
      }
    }

    // Calculate win amount based on symbol multiplier
    const symbol = this.config.content.symbols.find(s => s.id.toString() === paySymbol);
    const winAmount = symbol && count >= 3 ? (symbol.multiplier[count - 3] || 0) : 0;

    return {
      line,
      symbols: values,
      count,
      win: winAmount
    };
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
