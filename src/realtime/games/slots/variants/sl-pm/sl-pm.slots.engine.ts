import { GameEngine } from "../../../game.engine";
import { SLPMConfig, SLPMResponse, SLPMAction, CascadeResult } from "./sl-pm.slots.type";
import { SlotsInitData } from "../../../game.type";

class SLPMSlotsEngine extends GameEngine<
  SLPMConfig,
  SLPMAction,
  SLPMResponse,
  SlotsInitData
> {
  validateConfig(): void {
    const { matrix, lines, symbols } = this.config.content;
    // Add any specific validation logic if needed
  }

  async handleAction(action: SLPMAction): Promise<SLPMResponse> {
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

  protected async handleSpin(action: SLPMAction): Promise<SLPMResponse> {
    try {
      const { userId, payload } = action;
      this.validateConfig();

      const totalBetAmount =
        this.config.content.bets[payload.betAmount] *
        this.config.content.lines.length;

      const balance = await this.state.getBalance(userId, this.config.gameId);


      if (payload.betAmount > this.config.content.bets.length - 1) {
        throw new Error("Invalid bet amount");
      }

      if (this.config.content.bets[payload.betAmount] <= 0) {
        throw new Error("Something went wrong");
      }

      if (balance < totalBetAmount) {
        throw new Error("Balance is low");
      }

      await this.state.deductBalanceWithDbSync(
        userId,
        this.config.gameId,
        totalBetAmount
      );

      const { visibleReels, winningLines } = this.generateVisibleReels();
      const { matrix, cascades } = this.markWinningSymbols(
        visibleReels,
        winningLines,
        payload.betAmount
      );

      const totalAccWin = cascades.reduce(
        (sum, cascade) => sum + cascade.currentCascadeWin,
        0
      );
      let totalWin = Number(totalAccWin.toFixed(4));
      return {
        success: true,
        matrix,
        cascades,
        totalWin,
        player: {
          balance: Number((balance - totalBetAmount).toFixed(4)),
        },
      };

    } catch (error) {
      console.error(`Error processing spin for user`, error);
      throw error;
    }
  }

  private generateVisibleReels(): {
    visibleReels: string[][];
    winningLines: {
      lineIndex: number;
      paySymbol: string;
      win: number;
      indices: number[];
    }[];
  } {
    const matrix: string[][] = [];

    function shuffleArray<T>(array: T[]): T[] {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    // Generate and shuffle full reels
    for (let i = 0; i < this.config.content.matrix.x; i++) {
      const row: string[] = [];

      this.config.content.symbols.forEach((symbol) => {
        for (let j = 0; j < symbol.reelsInstance[i]; j++) {
          row.push(symbol.id.toString());
        }
      });

      matrix.push(shuffleArray([...row]));
    }

    // Select visible symbols window from each reel
    const resultMatrix: string[][] = [];

    for (let i = 0; i < matrix.length; i++) {
      const reel = matrix[i];
      const visibleSymbols: string[] = [];
      const startIdx = Math.floor(
        Math.random() * (reel.length - this.config.content.matrix.y + 1)
      );

      for (let j = 0; j < this.config.content.matrix.y; j++) {
        visibleSymbols.push(reel[(startIdx + j) % reel.length]);
      }

      resultMatrix.push(visibleSymbols);
    }

    const transposedMatrix = resultMatrix[0].map((_, colIndex) =>
      resultMatrix.map((row) => row[colIndex])
    );

    const linesResults = this.checkwin(transposedMatrix);

    return {
      visibleReels: transposedMatrix,
      winningLines: linesResults,
    };
  }

  private checkwin(
    matrix: string[][]
  ): {
    lineIndex: number;
    paySymbol: string;
    win: number;
    indices: number[];
  }[] {
    const linesResults: {
      lineIndex: number;
      paySymbol: string;
      win: number;
      indices: number[];
    }[] = [];
    const wildSymbol = "12";

    this.config.content.lines.forEach((line, lineIndex) => {
      const values = line.map((row, col) => matrix[row][col]);

      let paySymbol: string | null = null;
      const indices: number[] = [];
      let count = 0;

      // Check for winning symbols
      if (values[0] === wildSymbol) {
        for (let i = 1; i < values.length; i++) {
          if (values[i] !== wildSymbol) {
            const symbol = this.config.content.symbols.find(
              (s) => s.id.toString() === values[i]
            );
            if (symbol?.useWildSub) {
              paySymbol = values[i];
            }
            break;
          }
        }
        if (!paySymbol) return; // No win
      } else {
        paySymbol = values[0];
      }

      for (let i = 0; i < values.length; i++) {
        if (values[i] === paySymbol || values[i] === wildSymbol) {
          count++;
          indices.push(i);
        } else {
          break;
        }
      }

      if (count >= 3) {
        const symbolConfig = this.config.content.symbols.find(
          (s) => s.id.toString() === paySymbol
        );
        const win = (symbolConfig?.multiplier[count - 3] || 0) * count;
        linesResults.push({ lineIndex: lineIndex + 1, paySymbol, win, indices });
      }
    });

    return linesResults;
  }

  private markWinningSymbols(
    matrix: string[][],
    initialWinningLines: {
      lineIndex: number;
      paySymbol: string;
      win: number;
      indices: number[];
    }[],
    betAmount: number
  ): {
    matrix: string[][];
    cascades: CascadeResult[];
  } {
    const cascades: CascadeResult[] = [];
    let cascadeIndex = 0;

    const processWinsAndCascade = (
      currentMatrix: string[][],
      currentWinningLines: {
        lineIndex: number;
        paySymbol: string;
        win: number;
        indices: number[];
      }[]
    ): string[][] => {

      let _Tcascade = 0;

      if (currentWinningLines.length === 0) {
        return currentMatrix;
      }

      // Format winning lines for current cascade
      const formattedWinningLines = currentWinningLines.map(line => ({
        lineIndex: line.lineIndex,
        symbols: line.paySymbol,
        positions: line.indices
      }));

      // Calculate current cascade win
      const currentCascadeWin = currentWinningLines.reduce(
        (sum, line) => sum + line.win,
        0
      );

      // Mark winning symbols and prepare for cascade
      const markedMatrix = currentMatrix.map(row => [...row]);
      currentWinningLines.forEach(({ lineIndex, indices }) => {
        const winningLine = this.config.content.lines[lineIndex - 1];
        indices.forEach((col) => {
          const row = winningLine[col];
          if (markedMatrix[row]?.[col] !== undefined) {
            markedMatrix[row][col] = "-1";
          }
        });
      });

      // Generate new symbols and apply cascade
      const transposedMatrix = markedMatrix[0].map((_, colIndex) =>
        markedMatrix.map((row) => row[colIndex])
      );
      const newSymbolsToFill: string[][] = [];
      const cascadedMatrix = transposedMatrix.map((column, colIndex) => {
        const filteredSymbols = column.filter(symbol => symbol !== "-1");
        const emptyCount = column.length - filteredSymbols.length;

        const columnNewSymbols = [];
        for (let i = 0; i < emptyCount; i++) {
          const reelSymbols: string[] = [];
          this.config.content.symbols.forEach(symbol => {
            for (let j = 0; j < symbol.reelsInstance[colIndex]; j++) {
              reelSymbols.push(symbol.id.toString());
            }
          });
          const randomIndex = Math.floor(Math.random() * reelSymbols.length);
          columnNewSymbols.push(reelSymbols[randomIndex]);
        }

        newSymbolsToFill.push(columnNewSymbols);
        return columnNewSymbols.concat(filteredSymbols);
      });

      const newMatrix = cascadedMatrix[0].map((_, colIndex) =>
        cascadedMatrix.map(row => row[colIndex])
      );

      // Store cascade result
      cascades.push({
        cascadeIndex,
        winningLines: formattedWinningLines,
        symbolsToFill: newSymbolsToFill,
        currentCascadeWin: currentCascadeWin * this.config.content.bets[betAmount]
      });

      // Check for new wins
      const newWins = this.checkwin(newMatrix);

      if (newWins.length > 0) {
        cascadeIndex++;
        _Tcascade + 1
        return processWinsAndCascade(newMatrix, newWins);
      }

      console.log(_Tcascade, '_tcascade')

      return newMatrix;
    };

    processWinsAndCascade(matrix, initialWinningLines);

    return {
      matrix: matrix,
      cascades
    };
  }
}

export default SLPMSlotsEngine;
