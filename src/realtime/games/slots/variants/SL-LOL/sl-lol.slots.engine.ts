import logMethod from "../../../../../common/lib/decorators/logging.decorator";
import { GameEngine } from "../../../game.engine";
import { SlotsInitData } from "../../../game.type";
import { CombinationCheckContext, SLLOLAction, SLLOLConfig, SLLOLResponse, SLLOLSpecials, SLLOLSymbolConfig, WinningCombination } from "./sl-lol.slots.type";

class LifeOfLuxurySlotsEngine extends GameEngine<
  SLLOLConfig,
  SLLOLAction,
  SLLOLResponse,
  SlotsInitData
> {
  validateConfig(): void {
    const { matrix, lines, symbols } = this.config.content;

  }

  async handleAction(action: SLLOLAction): Promise<SLLOLResponse> {
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
        // lines: this.config.content.lines,
        bets: this.config.content.bets,
      },
      uiData: {
        paylines: {
          symbols: this.config.content.symbols.map((symbol) => ({
            id: symbol.id,
            name: symbol.name,
            multiplier: symbol.multiplier,
            description: symbol.description,
            isFreeSpinMultiplier: symbol.iSFreeSpinMultiplier
          })),
        },
      },
      player: {
        balance,
      },
    };
  }



  protected async handleSpin(action: SLLOLAction): Promise<SLLOLResponse> {
    try {
      const { userId, payload } = action;

      this.validateSpinPayload(payload);

      //NOTE: freespin checking from state
      let freeSpinCount: number = await this.state.
        getGameSpecificState(
          userId,
          this.config.gameId, "freeSpins"
        ) || 0
      // console.log(`freespin count from state`, freeSpinCount);
      let isFreeSpin = false;

      const totalBetAmount = this.calculateTotalBet(payload.betAmount);

      if (!freeSpinCount || freeSpinCount <= 0) {
        await this.validateAndDeductBalance(userId, totalBetAmount);
      } else {
        this.state.setGameSpecificState(
          userId,
          this.config.gameId,
          "freeSpins",
          freeSpinCount - 1
        );
      }

      const reels = this.getRandomMatrix()

      console.log("reels", reels.map(row => row.map(symbolId => symbolId || "Unknown Symbol")));


      let winCombinations: WinningCombination[] = []
      const specialFeatures = {}


      // console.log(" spins awarded now ", specialFeatures.freeSpinCount);

      //NOTE: set freespincount
      // if (specialFeatures.freeSpinCount && specialFeatures.freeSpinCount > 0) {
      //   isFreeSpin = true;
      //   this.state.setGameSpecificState(
      //     userId,
      //     this.config.gameId,
      //     "freeSpins",
      //     freeSpinCount + specialFeatures.freeSpinCount
      //   );
      // }
      // specialFeatures.freeSpinCount = freeSpinCount + specialFeatures.freeSpinCount;

      // console.log("final freespin ", specialFeatures.freeSpinCount);



      const totalWinAmount = 0


      this.config.content.symbols.forEach(symbol => {
        if (symbol.name !== SLLOLSpecials.FreeSpin && symbol.name !== SLLOLSpecials.Wild) {

          const combinationsForSymbol = this.checkCombinations(
            symbol.id,
            0,
            {
              matrix: reels.map(row => row.map(symbolId => symbolId.toString())),
              symbols: this.config.content.symbols,
              wildSymbolId: this.getWildSymbolId(),
              minMatchCount: this.config.content.minMatchCount,
              betPerLine: totalBetAmount
            }
          ) || [];
          if (combinationsForSymbol.length > 0) {
            winCombinations.push(...combinationsForSymbol);
          }
        }
      });


      // console.log("wincombs", JSON.stringify(winCombinations));


      if (totalWinAmount > 0) {
        await this.creditWinnings(userId, totalWinAmount * this.config.content.bets[payload.betAmount]);
      }

      const newBalance = await this.state.getBalance(userId, this.config.gameId);

      return this.buildSpinResponse(
        reels,
        winCombinations,
        specialFeatures,
        totalWinAmount,
        newBalance,
        payload.betAmount,
        isFreeSpin
      );
    } catch (error) {
      console.error(`Error processing spin for user`, error);
      throw error;
    }
  }

  private validateSpinPayload(payload: any): void {
    if (payload.betAmount > this.config.content.bets.length - 1) {
      throw new Error("Invalid bet amount");
    }
    if (this.config.content.bets[payload.betAmount] <= 0) {
      throw new Error("Something went wrong");
    }
  }

  private calculateTotalBet(betAmountIndex: number): number {
    return this.config.content.bets[betAmountIndex]
  }

  private async validateAndDeductBalance(userId: string, totalBetAmount: number): Promise<void> {
    const balance = await this.state.getBalance(userId, this.config.gameId);
    if (balance < totalBetAmount) {
      throw new Error("Balance is low");
    }
    await this.state.deductBalanceWithDbSync(userId, this.config.gameId, totalBetAmount);
  }



  // @logMethod
  private checkCombinations(
    symbolId: number,
    startCol: number,
    context: CombinationCheckContext
  ): WinningCombination[] | void {
    try {
      const { matrix, symbols, wildSymbolId, minMatchCount, betPerLine } = context;
      const cols = matrix[0].length;
      const winningCombinations: WinningCombination[] = [];

      if (cols - startCol + 1 < minMatchCount) return;

      for (let row = 0; row < matrix.length; row++) {
        const currentSymbol = matrix[row][startCol];
        // Convert both symbolId and wildSymbolId to strings for comparison
        if (currentSymbol !== symbolId.toString() && currentSymbol !== wildSymbolId.toString()) continue;

        const path: [number, number][] = [[row, startCol]];

        for (let col = startCol + 1; col < cols; col++) {
          let foundMatch = false;

          for (let r = 0; r < matrix.length; r++) {
            const nextSymbol = matrix[r][col];
            // Check if the next symbol matches the target or wild (both as strings)
            if (nextSymbol === symbolId.toString() || nextSymbol === wildSymbolId.toString()) {
              path.push([r, col]);
              foundMatch = true;
              break;
            }
          }

          if (!foundMatch) break;
        }

        if (path.length >= minMatchCount) {
          const symbol = symbols.find(s => s.id === symbolId);
          if (symbol?.multiplier) {
            // Ensure multiplier index is within bounds
            const multiplierIndex = path.length - minMatchCount;
            const multiplier = symbol.multiplier[multiplierIndex];
            if (multiplier !== undefined) {
              winningCombinations.push({
                symbolId,
                positions: path,
                payout: multiplier * betPerLine
              });
            }
          }
        }
      }

      return winningCombinations;
    } catch (e) {
      console.error("Error in checkCombinations", e);
    }
  }


  private async creditWinnings(userId: string, totalWinAmount: number): Promise<void> {
    await this.state.creditBalanceWithDbSync(userId, this.config.gameId, totalWinAmount);
  }

  private buildSpinResponse(
    reels: string[][],
    lineWins: Array<any>,
    specialFeatures: any,
    totalWinAmount: number,
    newBalance: number,
    betAmountIndex: number,
    isFreeSpin: boolean
  ): SLLOLResponse {
    const betMultiplier = this.config.content.bets[betAmountIndex];

    const features: any[] = []

    const spinResult = {
      id: "ResultData",
      payload: {
        winAmount: totalWinAmount * betMultiplier,
        // wins: lineWins.map((win) => {
        //   const lineIndex = win.line[0] - 1;
        //   const winningSymbolsInfo = this.getWinningSymbolsInfo(win.symbols, lineIndex);
        //   return {
        //     line: lineIndex,
        //     positions: winningSymbolsInfo.positions,
        //     amount: win.amount * betMultiplier,
        //   };
        // }),
      },
      // ...( features.freeSpin ? features : {}),
    };

    return {
      success: true,
      matrix: reels,
      ...spinResult,
      player: {
        balance: newBalance,
      },
    };
  }



  protected shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  protected getRandomMatrix(): string[][] {
    const matrix = this.generateFullReels();
    const resultMatrix = this.extractVisibleSegments(matrix);
    return this.transposeMatrix(resultMatrix);
  }

  private generateFullReels(): string[][] {
    const matrix: string[][] = [];

    for (let i = 0; i < this.config.content.matrix.x; i++) {
      const row: string[] = [];

      this.config.content.symbols.forEach((symbol) => {
        for (let j = 0; j < symbol.reelsInstance[i]; j++) {
          row.push(symbol.id.toString());
        }
      });

      matrix.push(this.shuffleArray([...row]));
    }
    return matrix;
  }

  private extractVisibleSegments(matrix: string[][]): string[][] {
    const resultMatrix: string[][] = [];

    for (let i = 0; i < matrix.length; i++) {
      const reel = matrix[i];
      const visibleSymbols: string[] = [];

      const startIdx = Math.floor(
        Math.random() * (reel.length - this.config.content.matrix.y)
      );

      for (let j = 0; j < this.config.content.matrix.y; j++) {
        visibleSymbols.push(reel[(startIdx + j) % reel.length]);
      }

      resultMatrix.push(visibleSymbols);
    }
    return resultMatrix;
  }

  private transposeMatrix(matrix: string[][]): string[][] {
    return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
  }


  private getFreeSpinSymbolId(): string {
    return this.config.content.symbols
      .find((s) => s.name === SLLOLSpecials.FreeSpin)
      ?.id.toString() ?? "";
  }

  private getWildSymbolId(): string {
    return this.config.content.symbols
      .find((s) => s.name === SLLOLSpecials.Wild)
      ?.id.toString() ?? "";
  }

  private getSymbolConfig(symbolId: string) {
    return this.config.content.symbols.find((s) => s.id.toString() === symbolId);
  }


  protected checkForSpecialSymbols(matrix: string[][]) {
    const symbolCounts = this.countAllSymbols(matrix);
    const specialSymbols = [];

    for (const [symbolId, count] of symbolCounts) {
      const symbolConfig = this.getSymbolConfig(symbolId);
      if (!symbolConfig || symbolConfig.useWildSub || !symbolConfig.enabled) continue;

      const minCount = symbolConfig.minSymbolCount || 0;
      if (count < minCount) continue;

      const result = {
        symbol: symbolId,
        symbolName: symbolConfig.name,
        count,

      };

      const wins = this.calculateSpecialWins(symbolConfig, count);

      Object.assign(result, wins);

      specialSymbols.push(result);
    }

    return specialSymbols;
  }

  private countAllSymbols(matrix: string[][]): Map<string, number> {
    const counts = new Map<string, number>();

    matrix.flat().forEach(symbolId => {
      counts.set(symbolId, (counts.get(symbolId) || 0) + 1);
    });

    return counts;
  }

  private calculateSpecialWins(symbolConfig: any, count: number) {
    const minCount = symbolConfig.minSymbolCount || 0;
    const multiplierIndex = count - minCount;

    switch (symbolConfig.name) {
      case SLLOLSpecials.FreeSpin:
        const freeSpins = symbolConfig.multiplier?.[multiplierIndex] || 0;
        return {
          specialWin: freeSpins,
          freeSpinCount: freeSpins
        };


      default:
        return {

        };
    }
  }

  protected accumulateWins(
    wins: Array<{ line: number[]; symbols: string[]; amount: number }>
  ): number {
    return wins.reduce((acc, win) => acc + win.amount, 0);
  }
}

export default LifeOfLuxurySlotsEngine;
