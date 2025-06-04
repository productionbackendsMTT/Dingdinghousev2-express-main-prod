import { GameEngine } from "../../../game.engine";
import { SLPMConfig, SLPMResponse, SLPMAction, specialIcons } from "./sl-pm.slots.type";
import { SlotsInitData } from "../../../game.type";
import { symbol } from "zod";
class BaseSlotsEngine extends GameEngine<
  SLPMConfig,
  SLPMAction,
  SLPMResponse,
  SlotsInitData
> {
  validateConfig(): void {
    const { matrix, lines, symbols } = this.config.content;
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
      const totalBetAmount = this.config.content.bets[payload.betAmount] * this.config.content.lines.length;;
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

      await this.state.deductBalanceWithDbSync(userId, this.config.gameId, totalBetAmount);

      const { visibleReels, winningLines } = this.generateVisibleReels();
      return {
        success: true,
        matrix: visibleReels,
        winningLines: winningLines,
        player: {
          balance: balance - totalBetAmount,
        },
      }

    } catch (error) {
      console.error(`Error processing spin for user`, error);
      throw error;
    }


  }

  // generate matrix according to config matrix both axis size
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

      const startIdx = Math.floor(Math.random() * (reel.length - this.config.content.matrix.y + 1));

      for (let j = 0; j < this.config.content.matrix.y; j++) {
        visibleSymbols.push(reel[(startIdx + j) % reel.length]);
      }

      resultMatrix.push(visibleSymbols);

    }
    const transposedMatrix = resultMatrix[0].map((_, colIndex) =>
      resultMatrix.map((row) => row[colIndex])
    );

    // Prepare output for line results 
    const linesResults: {
      lineIndex: number;
      paySymbol: string;
      win: number;
      indices: number[];
    }[] = [];

    const wildSymbol = '12';

    this.config.content.lines.forEach((line, lineIndex) => {

      const values = line.map((row, col) => transposedMatrix[row][col]);

      let paySymbol: string | null = null;
      const indices: number[] = [];
      let count = 0;

      // If first symbol is wild, find the next paySymbol
      if (values[0] === wildSymbol) {
        for (let i = 1; i < values.length; i++) {
          if (values[i] !== wildSymbol) {
            const symbol = this.config.content.symbols.find((s) => s.id.toString() === values[i]);
            if (symbol?.useWildSub) {
              paySymbol = values[i];
            }
            break;
          }
        }
        if (!paySymbol) {
          // no valid paySymbol found, no win on this line
          linesResults.push({ lineIndex: lineIndex + 1, paySymbol: values[0], win: 0, indices: [] });
          return;
        }
      } else {
        const firstSymbolConfig = this.config.content.symbols.find((s) => s.id.toString() === values[0]);
        if (!firstSymbolConfig?.useWildSub) {
          // The first symbol does not count as paySymbol if it uses wild substitution
          linesResults.push({ lineIndex: lineIndex + 1, paySymbol: values[0], win: 0, indices: [] });
          return;
        }
        paySymbol = values[0];
      }

      // Count consecutive symbols matching paySymbol or wildSymbol and track indices
      for (let i = 0; i < values.length; i++) {
        if (values[i] === paySymbol || values[i] === wildSymbol) {
          count++;
          indices.push(i);
        } else {
          break;
        }
      }

      if (count >= 3) {

        const symbolConfig = this.config.content.symbols.find((s) => s.id.toString() === paySymbol);
        const multiplierIndex = this.config.content.matrix.x - count;
        const win = symbolConfig ? symbolConfig.multiplier[multiplierIndex] || 0 : 0;
        linesResults.push({ lineIndex: lineIndex + 1, paySymbol, win, indices });
      }
    });
    this.markWinningSymbols(transposedMatrix, linesResults);

    return {
      visibleReels: transposedMatrix,
      winningLines: linesResults,
    };
  }

  private markWinningSymbols(
    matrix: string[][],
    winningLines: {
      lineIndex: number;
      paySymbol: string;
      win: number;
      indices: number[];
    }[]
  ): string[][] {
    const updatedMatrix = matrix.map((row) => [...row]);

    // Mark winning symbols as `-1`
    winningLines.forEach(({ lineIndex, indices }) => {
      const winningLine = this.config.content.lines[lineIndex - 1];

      indices.forEach((col) => {
        const row = winningLine[col];
        if (updatedMatrix[row]?.[col] !== undefined) {
          updatedMatrix[row][col] = '-1';
        }
      });
    });

    const applyCascade = (matrix: string[][]): string[][] => {
      const transposedMatrix = matrix[0].map((_, colIndex) =>
        matrix.map((row) => row[colIndex])
      );
      const cascadedMatrix = transposedMatrix.map((column) => {
        const filteredSymbols = column.filter((symbol) => symbol !== "-1");
        const emptySpaces = new Array(column.length - filteredSymbols.length).fill("");
        return emptySpaces.concat(filteredSymbols);
      });

      return cascadedMatrix[0].map((_, colIndex) =>
        cascadedMatrix.map((row) => row[colIndex])
      );
    };

    const cascadedMatrix = applyCascade(updatedMatrix);
    console.log(cascadedMatrix, "Matrix after cascade");

    return cascadedMatrix;
  }















  // protected checkwin(matrix: string[][], _side: string): { symbol: string, count: number, indices: number[], _Cline: any[] } | null {
  //   for (let currentLine = 0; currentLine < this.config.content.lines.length; currentLine++) {
  //     const _Cline = this.config.content.lines[currentLine];
  //     const _ClineSymbols = _Cline.map((row, col) => matrix[row][col]);

  //     const findWin = (start: number, dir: number) => {
  //       for (let i = start; dir === 1 ? i < _ClineSymbols.length : i >= 0; i += dir) {
  //         let count = 1;
  //         const symbol = _ClineSymbols[i];

  //         for (let j = i + dir; (dir === 1 ? j < _ClineSymbols.length : j >= 0) && _ClineSymbols[j] === symbol; j += dir) {
  //           count++;
  //         }

  //         if (count >= 3) {
  //           const indices = [];
  //           for (let k = 0; k < count; k++) {
  //             indices.push(i + k * dir);
  //           }
  //           return { symbol, count, indices: indices.sort((a, b) => a - b) };
  //         }

  //         i += (count - 1) * dir;
  //       }
  //       return null;
  //     };

  //     const ltrWin = findWin(0, 1);
  //     const rtlWin = _side === 'RTL' ? findWin(_ClineSymbols.length - 1, -1) : null;

  //     const winResult = (ltrWin && rtlWin) ? ltrWin : (ltrWin || rtlWin);

  //     if (winResult) {
  //       
  //       return { ...winResult, _Cline };
  //     }
  //   }

  //   return null;
  // }


}

export default BaseSlotsEngine;
