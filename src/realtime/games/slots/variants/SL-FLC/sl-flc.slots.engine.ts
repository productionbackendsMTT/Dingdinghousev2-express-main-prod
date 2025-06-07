import logMethod from "../../../../../common/lib/decorators/logging.decorator";
import { PlayerState } from "../../../../gateways/playground/playground.types";
import { GameEngine } from "../../../game.engine";
import { SlotsInitData } from "../../../game.type";
import { getRandomFromProbability } from "../../common/weightedPick";
import { cryptoRng, precisionRound } from "../../gameUtils.slots";
import { SLFLCAction, SLFLCCheckForFreeSpinContext, SLFLCConfig, SLFLCResponse, SLFLCSpecials, SLFLCSymbolConfig, ValueType, WinningCombination } from "./sl-flc.slots.type";

class UltimateFirelinkSlotEngine extends GameEngine<
  SLFLCConfig,
  SLFLCAction,
  SLFLCResponse,
  SlotsInitData
> {


  validateConfig(): void {
    const { matrix, lines, symbols } = this.config.content;
  }

  async handleAction(action: SLFLCAction): Promise<SLFLCResponse> {
    console.log("action:", action);
    // console.log("action option:", action.payload.option, "/", this.config.content.features.freespin.freespinOptions.length);


    switch (action.type.trim()) {
      case "spin":
        return this.handleSpin(action);
      case "freespin":
        const opt = action.payload.option

        if (opt === undefined || (opt < 0 || opt >= this.config.content.features.freespin.freespinOptions.length)) {
          throw new Error("Invalid freespin option");
        } else {
          await this.state.setGameSpecificState(action.userId, this.config.gameId, "freeSpins", this.config.content.features.freespin.freespinOptions[opt].count)
          await this.state.setGameSpecificState(action.userId, this.config.gameId, "freeSpinOption", opt)
          return {
            success: true,
            player: {
              balance: 0
            }
          }
        }
      default:
        throw new Error(`Unknown action: ${action.type}`);
    }
  }

  public async getInitData(userId: string): Promise<SlotsInitData> {
    const playerState = await this.state.getSafeState(userId, this.config.gameId) as PlayerState;
    await this.state.updatePartialState(userId, this.config.gameId, playerState)

    // console.log("syms", this.config.content.symbols)
    // const [balance] = await Promise.all([
    //   this.state.getBalance(userId, this.config.gameId),
    //   this.state.setGameSpecificState(userId, this.config.gameId, "freeSpinOption", this.config.content.features.freespin.defaultFreespinOption),
    //   this.state.setGameSpecificState(userId, this.config.gameId, "freeSpins", 0),
    //   this.state.setGameSpecificState(userId, this.config.gameId, "bonusCount", 0)
    // ]);

    return {
      id: "initData",
      gameData: {
        lines: this.config.content.lines,
        bets: this.config.content.bets,
        freespinOptions: this.config.content.features.freespin.freespinOptions,
        jackpotMultipliers: this.config.content.features.bonus.scatterValues.slice(
          this.config.content.features.bonus.scatterValues.length - 4
        ),
        bonusTrigger: this.config.content.features.bonus.scatterTrigger,
      },
      uiData: {
        paylines: {
          symbols: this.config.content.symbols.map((symbol) => ({
            id: symbol.id,
            name: symbol.name,
            multiplier: symbol.multiplier,
            description: symbol.description,
            useBonus: symbol.useBonus,
          })),
        },
      },
      player: {
        balance: playerState.balance || 0,
      },
    };
  }



  protected checkLines(
    matrix: string[][],
    isFreeSpin: boolean,
    freespinOption: number
  ): Array<{
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
      const lineResult = this.checkLineSymbols(values, line, isFreeSpin, freespinOption);

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


  @logMethod
  protected async populateScatterValues(matrix: string[][], scatterValues: ValueType[], type: "bonus" | "base") {
    // const matrix = type === "base" ? settings.resultSymbolMatrix : settings.bonusResultMatrix
    let result: ValueType[] = []
    let bonusCount = 0

    const prevScatter = scatterValues.map(v => `${v.index[0]},${v.index[1]}`)

    matrix.map((row, x) => {
      row.map((symbol, y) => {
        if (symbol === this.getScatterSymbolId()) {
          if (!prevScatter.includes(`${x},${y}`)) {
            if (type === "bonus") {
              bonusCount = 3
            }
            //NOTE: add scatter to values
            const scatterValue = this.config.content.features.bonus.scatterValues[getRandomFromProbability(this.config.content.features.bonus.scatterProbs, cryptoRng) - 1]
            // console.log("populate sc", x, y, scatterValue);

            result.push({
              value: scatterValue,
              index: [x, y]
            })
          }
        }
      })
    })
    return { result, bonusCount }
  }


  @logMethod
  protected async checkForBonus(scatterCount: number, scatterTrigger: any[]) {
    if (scatterCount >= scatterTrigger[0].count[0]) {
      // settings.bonus.scatterCount = settings.scatter.values.length
      // settings.bonus.isTriggered = true
      // settings.bonus.spinCount = 3

      // const triggers = settings.scatter.bonusTrigger
      // const rows = rowsOnExpand(scatterCount, triggers)
      // const currentRows = settings.currentGamedata.matrix.y
      // if (rows !== currentRows) {
      //
      //   settings.currentGamedata.matrix.y = rows
      //   settings.scatter.values = shiftScatterValues(settings.scatter.values, rows - currentRows)
      // }
      return true
    }
    return false
  }


  private async handleBonusSpin(ctx: any) {
    //TODO: bonus matrix generation
    const { result: scatterValues, bonusCount } = await this.populateScatterValues(ctx.matrix, ctx.scatterValues, "bonus")
    let isFreespin = false
    let totalPayout = 0

    const scatterCount = ctx.scatterValues.length
    //TODO: Decrease bonus spin count
    // settings.bonus.spinCount--


    //NOTE: bonus inside freespin
    if ((bonusCount - 1) < 0 && ctx.freespinCount === ctx.freespinOptions[ctx.freespinOptionIndex].count) {
      //TODO: send isFreespin true
      // settings.isFreespin = true
      isFreespin = true
    }
    //TODO: send scatterCount 
    // settings.bonus.scatterCount = scatterCount
    if (scatterCount === 40) {
      //TODO: end bonus when we hit max scatter
      // settings.bonus.spinCount = -1
    }
    if (ctx.bonusSpinCount < 0) {
      totalPayout = await this.collectScatter({})
    }
    return {
      bonusCount, isFreespin, scatterCount, totalPayout
    }
  }
  protected async collectScatter(ctx: any) {
    const totalPayout = ctx.scatterValues.reduce((acc: any, sc: any) => acc + sc.value, 0)
    console.log(totalPayout);

    return totalPayout

  }

  protected async handleSpin(action: SLFLCAction): Promise<SLFLCResponse> {
    try {
      const { userId, payload } = action;

      this.validateSpinPayload(payload);

      let playerState = await this.state.getSafeState(userId, this.config.gameId) as PlayerState
      console.log("player state", (playerState.gameSpecific || {}));
      //NOTE: freespin count checking from state
      let freeSpinCount: number = playerState.gameSpecific?.freeSpins || 0;
      // console.log(`freespin count from state`, freeSpinCount);
      const totalBetAmount = this.calculateTotalBet(payload.betAmount ?? 0);
      let reels: string[][] = []

      let scatterValues: ValueType[] = []
      let totalWinAmount = 0;
      let isFreeSpin = false;
      let lineWins: {
        line: number[];
        symbols: string[];
        amount: number;
      }[] = []

      let isBonus = false
      if (playerState.gameSpecific?.bonusCount <= 0) {

        //NOTE: base non bonus spins
        reels = this.getRandomMatrix("base", this.config.content.matrix.y);
        console.log("reels", reels.map(row => row.map(symbolId => symbolId || "Unknown Symbol")));


        let ctx: SLFLCCheckForFreeSpinContext = {
          matrix: reels,
          freeSpinSymbolId: this.getFreeSpinSymbolId(),
          isEnabled: this.config.content.features.freespin.isEnabled
        }
        //NOTE: since we we disabled freespin within freespin
        isFreeSpin = false

        isFreeSpin = this.checkForFreespin(ctx)

        lineWins = this.checkLines(reels, freeSpinCount > 0, playerState.gameSpecific.freeSpinOption);
        // console.log("linwins : ", lineWins);

        //NOTE: set freespincount spagatti if else ladder
        if (!freeSpinCount || freeSpinCount <= 0) {
          // await this.validateAndDeductBalance(userId, totalBetAmount);
          playerState.balance -= totalBetAmount
          playerState.currentBet = totalBetAmount;

          console.log(" deducting bet amount", totalBetAmount);

          //NOTE: freespin trigger
          if (isFreeSpin) {
            freeSpinCount = this.config.content.features.freespin.freespinOptions[playerState.gameSpecific.freeSpinOption].count;
          }
        } else {
          playerState.currentBet = 0

          //NOTE: freespin freespin within freespin
          freeSpinCount = (isFreeSpin ?
            this.config.content.features.freespin.freespinOptions[playerState.gameSpecific.freeSpinOption].count - 1
            : freeSpinCount - 1);
        }
        playerState.gameSpecific.freeSpins = freeSpinCount;

        console.log(" spins awarded ", isFreeSpin, freeSpinCount);



        if (lineWins.length > 0) {
          lineWins.forEach((win) => {
            totalWinAmount += win.amount;
          })
        }

        if (totalWinAmount > 0) {
          // await this.creditWinnings(userId, totalWinAmount * totalBetAmount);
          playerState.balance = precisionRound((playerState.balance + totalWinAmount * totalBetAmount), 5)
        }
        console.log("win", totalWinAmount, playerState.balance);

        playerState.currentWinning = precisionRound(totalWinAmount * totalBetAmount, 5)

        await this.state.updatePartialState(userId, this.config.gameId, playerState)

      }

      const { result } = await this.populateScatterValues(reels, playerState.gameSpecific?.scatterValues || [], "base");
      scatterValues = result;
      console.log("scatter values", scatterValues);


      isBonus = await this.checkForBonus(scatterValues.length, this.config.content.features.bonus.scatterTrigger);

      console.log("isbonus", isBonus);
      //NOTE: handle bonus
      // if(){
      //
      // }


      return this.buildSpinResponse(
        reels,
        lineWins,
        {
          isFreeSpin,
          count: freeSpinCount,
          scatterValues,
        },
        totalWinAmount,
        // newBalance,
        playerState.balance,
        payload.betAmount as number,
      )

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

  private checkForFreespin(Context: SLFLCCheckForFreeSpinContext): boolean {
    try {
      const { matrix, freeSpinSymbolId, isEnabled } = Context;


      if (!isEnabled) return false; // If free spins are not enabled, return false
      const rows = matrix.length;

      // Check if 1st, 2nd, and 3rd columns have symbol with ID 12 regardless of row
      let col1Has12 = false;
      let col2Has12 = false;
      let col3Has12 = false;


      for (let j = 0; j < rows; j++) { // Loop through rows
        if (matrix[j][1] == freeSpinSymbolId) col1Has12 = true; // Check 1st column
        if (matrix[j][2] == freeSpinSymbolId) col2Has12 = true; // Check 2nd column
        if (matrix[j][3] == freeSpinSymbolId) col3Has12 = true; // Check 3rd column


        // If all three columns have the symbol, return true
        if (col1Has12 && col2Has12 && col3Has12) {
          return true;
        }
      }

      // If one of the columns doesn't have the symbol, return false
      return false;


    } catch (e) {
      console.error("Error in checkForFreespin:", e);
      return false; // Handle error by returning false in case of failure
    }
  }

  private async creditWinnings(userId: string, totalWinAmount: number): Promise<void> {
    await this.state.creditBalanceWithDbSync(userId, this.config.gameId, totalWinAmount);
  }

  private buildSpinResponse(
    reels: string[][],
    lineWins: Array<any>,
    specialFeatures: {
      count: number,
      isFreeSpin: boolean,
      scatterValues: ValueType[]
    },
    totalWinAmount: number,
    newBalance: number,
    betAmountIndex: number,
  ): SLFLCResponse {
    const betMultiplier = this.config.content.bets[betAmountIndex];

    // const features: any[] = []

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
      features: {
        freeSpin: {
          isFreeSpin: specialFeatures?.isFreeSpin || false,
          count: specialFeatures?.count,
        },
        scatter: {
          values: specialFeatures?.scatterValues || [],
        }
      }
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

  protected getRandomMatrix(type: "base" | "bonus", rows: number): string[][] {
    const matrix = this.generateFullReels(type);
    let resultMatrix = this.extractVisibleSegments(matrix);
    switch (type) {
      case "base":
        resultMatrix = this.extractVisibleSegments(resultMatrix);
        break;
      case "bonus":
        resultMatrix = this.extractVisibleSegmentsForBonus({ matrix: resultMatrix, rows });
        break;
      default:
        throw new Error("Invalid matrix type in getRandomMatrix");
    }
    // const resultMatrix = [
    //   ["1", "1", "1", "1", "1"],
    //   ["1", "1", "1", "1", "1"],
    //   ["1", "1", "1", "1", "1"],
    // ]
    return this.transposeMatrix(resultMatrix);
  }

  private generateFullReels(type: "base" | "bonus"): string[][] {
    const matrix: string[][] = [];

    for (let i = 0; i < this.config.content.matrix.x; i++) {
      const row: string[] = [];

      this.config.content.symbols.forEach((symbol) => {
        for (let j = 0; j < symbol.reelsInstance[i]; j++) {
          if (type === "base") {
            //NOTE: no blanks in base spin 
            if (symbol.name !== SLFLCSpecials.Blank) {
              row.push(symbol.id.toString());
            }
          } else if (type === "bonus") {
            //NOTE: bonus can have blanks or scatter
            if (symbol.useBonus) {
              row.push(symbol.id.toString());
            }

          }
        }
      });

      matrix.push(this.shuffleArray([...row]));
    }
    return matrix;
  }


  private extractVisibleSegmentsForBonus(ctx: { matrix: string[][], rows: number }): string[][] {
    const resultMatrix: string[][] = [];

    for (let i = 0; i < ctx.matrix.length; i++) {
      const reel = ctx.matrix[i];
      const visibleSymbols: string[] = [];

      const startIdx = Math.floor(
        Math.random() * (reel.length - ctx.rows)
      );

      for (let j = 0; j < ctx.rows; j++) {
        visibleSymbols.push(reel[(startIdx + j) % reel.length]);
      }

      resultMatrix.push(visibleSymbols);
    }
    return resultMatrix;
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

  protected checkLineSymbols(values: string[], line: number[], isFreeSpin: boolean, freespinOption: number): {
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
    let winAmount = this.calculateLineWin(paySymbol, count);
    //NOTE: freespin multipliers 
    if (isFreeSpin) {
      switch (count) {
        case 3:
          winAmount *= this.config.content.features.freespin.freespinOptions[freespinOption].multiplier[0];
          break;
        case 4:
          winAmount *= this.config.content.features.freespin.freespinOptions[freespinOption].multiplier[1];
          break;
        case 5:
          winAmount *= this.config.content.features.freespin.freespinOptions[freespinOption].multiplier[2];
          break;
      }
    }

    return { count, win: winAmount };
  }


  private calculateLineWin(paySymbol: string, count: number): number {
    if (count < 3) return 0;

    const symbol = this.getSymbolConfig(paySymbol);
    if (!symbol) return 0;

    const multiplierIndex = this.config.content.matrix.x - count;
    return symbol.multiplier[multiplierIndex] || 0;
  }
  private getScatterSymbolId(): string {
    return this.config.content.symbols
      .find((s) => s.name === SLFLCSpecials.Scatter)
      ?.id.toString() ?? "";
  }

  private getFreeSpinSymbolId(): string {
    return this.config.content.symbols
      .find((s) => s.name === SLFLCSpecials.Freespin)
      ?.id.toString() ?? "";
  }

  private getWildSymbolId(): string {
    return this.config.content.symbols
      .find((s) => s.name === SLFLCSpecials.Wild)
      ?.id.toString() ?? "";
  }

  private getSymbolConfig(symbolId: string) {
    return this.config.content.symbols.find((s) => s.id.toString() === symbolId);
  }


  // protected checkForSpecialSymbols(matrix: string[][]) {
  //   const symbolCounts = this.countAllSymbols(matrix);
  //   const specialSymbols = [];
  //
  //   for (const [symbolId, count] of symbolCounts) {
  //     const symbolConfig = this.getSymbolConfig(symbolId);
  //     if (!symbolConfig || symbolConfig.useWildSub || !symbolConfig.enabled) continue;
  //
  //     const minCount = symbolConfig.minSymbolCount || 0;
  //     if (count < minCount) continue;
  //
  //     const result = {
  //       symbol: symbolId,
  //       symbolName: symbolConfig.name,
  //       count,
  //
  //     };
  //
  //     const wins = this.calculateSpecialWins(symbolConfig, count);
  //
  //     Object.assign(result, wins);
  //
  //     specialSymbols.push(result);
  //   }
  //
  //   return specialSymbols;
  // }

  // private countAllSymbols(matrix: string[][]): Map<string, number> {
  //   const counts = new Map<string, number>();
  //
  //   matrix.flat().forEach(symbolId => {
  //     counts.set(symbolId, (counts.get(symbolId) || 0) + 1);
  //   });
  //
  //   return counts;
  // }

  // private calculateSpecialWins(symbolConfig: any, count: number) {
  //   const minCount = symbolConfig.minSymbolCount || 0;
  //   const multiplierIndex = count - minCount;
  //
  //   switch (symbolConfig.name) {
  //     case SLFLCSpecials.Freespin:
  //       const freeSpins = symbolConfig.multiplier?.[multiplierIndex] || 0;
  //       return {
  //         specialWin: freeSpins,
  //         freeSpinCount: freeSpins
  //       };
  //
  //
  //     default:
  //       return {
  //
  //       };
  //   }
  // }

  protected accumulateWins(
    wins: Array<{ line: number[]; symbols: string[]; amount: number }>
  ): number {
    return wins.reduce((acc, win) => acc + win.amount, 0);
  }
}

export default UltimateFirelinkSlotEngine;
