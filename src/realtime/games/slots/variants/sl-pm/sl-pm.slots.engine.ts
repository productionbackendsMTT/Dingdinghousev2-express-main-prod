import { GameEngine } from "../../../game.engine";
import { SLPMConfig, SLPMResponse, SLPMAction, specialIcons } from "./sl-pm.slots.type";
import { SlotsInitData } from "../../../game.type";
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

      this.validateSpinPayload(payload);
      //@** GETTING CACHED _TOTALNUMOFCASCADING**@
      let totalNumOfCascading: number = await this.state.getGameSpecificState(
        userId,
        this.config.gameId,
        '_Tcascading'
      ) ?? 0;
      const totalBetAmount = this.calculateTotalBet(payload.betAmount);

      const reels = this.getRandomMatrix();
      const lineWins = this.checkLines(reels);
      if (lineWins.length > 0) {
        this.state.setGameSpecificState(userId, this.config.gameId, '_Tcascading', totalNumOfCascading + 1)
      } else (this.state.setGameSpecificState(
        userId,
        this.config.gameId,
        "_Tcascading",
        totalNumOfCascading - 1
      ))

      const specialFeatures = this.processSpecialFeatures(reels);

      const totalWinAmount = this.calculateTotalWinAmount(
        lineWins,
        specialFeatures,
        payload.betAmount
      );

      await this.validateAndDeductBalance(userId, totalBetAmount);

      if (totalWinAmount > 0) {
        await this.creditWinnings(userId, totalWinAmount * this.config.content.bets[payload.betAmount]);
      }

      const newBalance = await this.state.getBalance(userId, this.config.gameId);
      const isFreeSpin = false;
      return this.buildSpinResponse(
        reels,
        lineWins,
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
    return this.config.content.bets[betAmountIndex] * this.config.content.lines.length;
  }

  private async validateAndDeductBalance(userId: string, totalBetAmount: number): Promise<void> {
    const balance = await this.state.getBalance(userId, this.config.gameId);
    if (balance < totalBetAmount) {
      throw new Error("Balance is low");
    }
    await this.state.deductBalanceWithDbSync(userId, this.config.gameId, totalBetAmount);
  }
  private processSpecialFeatures(reels: string[][]) {
    const specialSymbols = this.checkForSpecialSymbols(reels);
    const features = {
      isJackpot: false,
      bonusResult: -1,
      freeSpinCount: 0,
      scatter: 0,
      specialSymbols
    };
    return features;
  }


  private calculateTotalWinAmount(
    lineWins: Array<any>,
    specialFeatures: any,
    betAmountIndex: number
  ): number {
    const lineWinAmount = this.accumulateWins(lineWins);

    const jackpotAmount = specialFeatures.isJackpot
      ? this.config.content.features.jackpot.defaultAmount
      : 0;

    return lineWinAmount + jackpotAmount ;
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
  ): SLPMResponse {
    const betMultiplier = this.config.content.bets[betAmountIndex];

    const features = this.buildFeatureResponse(specialFeatures, betMultiplier, isFreeSpin);

    const spinResult = {
      id: "ResultData",
      payload: {
        winAmount: totalWinAmount * betMultiplier,
        wins: lineWins.map((win) => {
          const lineIndex = win.line[0] - 1;
          const winningSymbolsInfo = this.getWinningSymbolsInfo(win.symbols, lineIndex);
          return {
            line: lineIndex,
            positions: winningSymbolsInfo.positions,
            amount: win.amount * betMultiplier,
          };
        }),
      },
      ...(features || {}),
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

  private buildFeatureResponse(specialFeatures: any, betMultiplier: number, isFreeSpin: boolean): any { 

    return {
      jackpot: {
        isTriggered: specialFeatures.isJackpot,
        amount: specialFeatures.isJackpot
          ? this.config.content.features.jackpot.defaultAmount * betMultiplier
          : 0
      },
      freeSpin: {
        count: specialFeatures.freeSpinCount,
        isFreeSpin: isFreeSpin,
      }

    };
  }

  protected getWinningSymbolsInfo(
    symbols: string[],
    lineIndex: number
  ): {
    symbols: string[];
    positions: number[];
  } {
    const wildSymbol = this.getWildSymbolId();
    const paySymbol = symbols.find((s) => s !== wildSymbol) || symbols[0];

    const winningSymbols: string[] = [];
    const winningPositions: number[] = [];

    for (let i = 0; i < symbols.length; i++) {
      if (symbols[i] === paySymbol || symbols[i] === wildSymbol) {
        winningSymbols.push(symbols[i]);
        winningPositions.push(i);
      } else {
        break;
      }
    }

    return {
      symbols: winningSymbols,
      positions: winningPositions,
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
          amount: lineResult.win,
        });
      }
    });

    return results;
  }

  protected checkLineSymbols(values: string[], line: number[]): {
    count: number;
    win: number;
  } {
    const wildSymbol = this.getWildSymbolId();
    let paySymbol: string | null = null;
    let count = 1;

    if (values[0] === wildSymbol) {
      paySymbol = this.findPayingSymbolAfterWild(values, wildSymbol);
      if (!paySymbol) {
        return { count: 0, win: 0 };
      }
      count = this.getWildSequenceCount(values, paySymbol, wildSymbol);
    } else {
      const firstSymbol = this.getSymbolConfig(values[0]);
      if (!firstSymbol?.useWildSub) {
        return { count: 0, win: 0 };
      }
      paySymbol = values[0];
    }

    count = this.countMatchingSymbols(values, paySymbol, wildSymbol, count);
    const winAmount = this.calculateLineWin(paySymbol, count);

    return { count, win: winAmount };
  }

  private getWildSymbolId(): string {
    return this.config.content.symbols
      .find((s) => s.name === "Wild")
      ?.id.toString() ?? "";
  }

  private getSymbolConfig(symbolId: string) {
    return this.config.content.symbols.find((s) => s.id.toString() === symbolId);
  }

  private findPayingSymbolAfterWild(values: string[], wildSymbol: string): string | null {
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== wildSymbol) {
        const symbol = this.getSymbolConfig(values[i]);
        if (symbol?.useWildSub) {
          return values[i];
        }
        break;
      }
    }
    return null;
  }

  private getWildSequenceCount(values: string[], paySymbol: string, wildSymbol: string): number {
    let count = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i] === wildSymbol || values[i] === paySymbol) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private countMatchingSymbols(
    values: string[],
    paySymbol: string,
    wildSymbol: string,
    startCount: number
  ): number {
    let count = startCount;

    for (let i = startCount; i < values.length; i++) {
      if (values[i] === paySymbol || values[i] === wildSymbol) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  private calculateLineWin(paySymbol: string, count: number): number {
    if (count < 3) return 0;

    const symbol = this.getSymbolConfig(paySymbol);
    if (!symbol) return 0;

    const multiplierIndex = this.config.content.matrix.x - count;
    return symbol.multiplier[multiplierIndex] || 0;
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

    switch (symbolConfig.name) {
      case specialIcons.jackpot:
        return {
          specialWin: symbolConfig.defaultAmount || 0,
          freeSpinCount: 0
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

export default BaseSlotsEngine;
