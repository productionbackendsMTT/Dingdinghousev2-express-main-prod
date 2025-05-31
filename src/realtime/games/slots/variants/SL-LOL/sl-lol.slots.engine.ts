import logMethod from "../../../../../common/lib/decorators/logging.decorator";
import { PlayerState } from "../../../../gateways/playground/playground.types";
import { GameEngine } from "../../../game.engine";
import { SlotsInitData } from "../../../game.type";
import { gambleResponse, getGambleResult } from "../../common/gamble";
import { CombinationCheckContext, SLLOLAction, SLLOLCheckForFreeSpinContext, SLLOLConfig, SLLOLResponse, SLLOLSpecials, SLLOLSymbolConfig, WinningCombination } from "./sl-lol.slots.type";

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
    console.log("action: ", action);
    console.log("actiontype: ", action.type, action.type === "gamble");


    switch (action.type.trim()) {
      case "spin":
        return this.handleSpin(action);
      case "gamble":
        if (this.config.content.features.gamble.isEnabled) {

          if (action.payload.Event === "init") {
            //NOTE: handle gamble init
            await this.handleGambleInit(action);
            return {
              success: true,
              player: {
                balance: 0
              }
            }
          } else if (action.payload.Event === "draw") {
            const result = await this.handleGambleDraw(action)
            if (result === undefined) {
              throw new Error("Gamble draw failed, result is undefined");
            }
            return {
              success: true,
              player: {
                balance: result.balance,
              },
              payload: {
                ...result,
              }
            }
          } else if (action.payload.Event === "collect") {
            let balc = await this.handleGambleCollect(action);
            return {
              success: true,
              player: {
                balance: balc
              }
            }
          }
        } else {

          throw new Error(`Gamble disabled: ${action.type}`);
        }
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
            isFreeSpinMultiplier: symbol.isFreeSpinMultiplier
          })),
        },
      },
      player: {
        balance,
      },
    };
  }


  //NOTE: handle gamble init
  protected async handleGambleInit(action: SLLOLAction) {

    const playerState = await this.state.getSafeState(action.userId, this.config.gameId) as PlayerState;
    if (playerState.currentWinning && playerState.currentWinning > 0) {
      // if current winning is already set, do not reset it

      await this.updatePlayerState(action.userId, {
        currentWinning: playerState.currentWinning || 0,
        balance: playerState.balance - (action.payload.lastWinning || 0),
      })
      return;
    } else {
      throw new Error("Current winning is not set or is zero, cannot proceed with gamble init");
    }
    // await this.validateAndDeductBalance(action.userId, action.payload.lastWinning ?? 0);
  }


  //NOTE: handle gamble draw
  protected async handleGambleDraw(action: SLLOLAction) {

    if (action.payload.cardSelected === "BLACK" || action.payload.cardSelected === "RED") {
      const playerState = await this.state.getSafeState(action.userId, this.config.gameId) as PlayerState;

      let result = getGambleResult({ selected: action.payload.cardSelected });
      //calculate payout
      switch (result.playerWon) {
        case true:
          playerState.currentWinning *= 2
          result.balance = playerState.balance + playerState.currentWinning;
          result.currentWinning = playerState.currentWinning;
          break;
        case false:
          result.currentWinning = 0;
          result.balance = playerState.balance
          playerState.currentWinning = 0;
          break;
      }

      await this.state.setGameSpecificState(
        action.userId,
        this.config.gameId,
        "currentWinning",
        playerState.currentWinning
      );
      console.log("result", result);

      return result;

      // this.sendMessage("GambleResult", result) // result card 
    } else {
      console.error("Invalid card type for gamble draw", action.payload.cardSelected);
    }
  }

  //NOTE: handle gamble collect
  protected async handleGambleCollect(action: SLLOLAction) {
    const playerState = await this.state.getSafeState(action.userId, this.config.gameId) as PlayerState;
    playerState.balance += playerState.currentWinning;
    await this.state.updatePartialState(action.userId, this.config.gameId, playerState);
    return playerState.balance;
  }

  protected async handleSpin(action: SLLOLAction): Promise<SLLOLResponse> {
    try {
      const { userId, payload } = action;


      this.validateSpinPayload(payload);

      let playerState = await this.state.getSafeState(userId, this.config.gameId) as PlayerState

      console.log("player state", (playerState));


      let freeSpinMultSymbols: number[] = this.config.content.symbols.filter((s) => s.isFreeSpinMultiplier).map((s) => s.id);


      //NOTE: freespin count checking from state
      let freeSpinCount: number = playerState.gameSpecific?.freeSpins || 0;
      // console.log(`freespin count from state`, freeSpinCount);

      const totalBetAmount = this.calculateTotalBet(payload.betAmount);

      const reels = this.getRandomMatrix()

      let winCombinations: WinningCombination[] = []

      let ctx: SLLOLCheckForFreeSpinContext = {
        matrix: reels,
        freeSpinSymbolId: this.getFreeSpinSymbolId(),
        isEnabled: this.config.content.features.freeSpin.isEnabled
      }
      const isFreeSpin = this.checkForFreespin(ctx)

      //NOTE: set freespincount
      // spagatti if else ladder
      if (!freeSpinCount || freeSpinCount <= 0) {
        // await this.validateAndDeductBalance(userId, totalBetAmount);
        playerState.balance -= totalBetAmount
        playerState.currentBet = totalBetAmount;

        console.log(" deducting bet amount", totalBetAmount);





        //NOTE: freespin within freespin
        if (isFreeSpin) {
          // If it's a free spin trigger situation, we increment 
          // this.state.setGameSpecificState(
          //   userId,
          //   this.config.gameId,
          //   "freeSpins",
          //   freeSpinCount + this.config.content.features.freeSpin.incrementCount
          // );
          freeSpinCount += this.config.content.features.freeSpin.incrementCount;

          playerState.gameSpecific.freeSpinMults = [1, 1, 1, 1, 1];
        }
      } else {

        //NOTE: handle freespin mult symbol count tracker
        let mults = playerState.gameSpecific.freeSpinMults || [1, 1, 1, 1, 1]
        reels.flat().forEach((symbolId) => {
          if (!isNaN(parseInt(symbolId))) {
            freeSpinMultSymbols.forEach((sym, idx) => {
              if (parseInt(symbolId) === sym) {
                if (mults[idx]) {
                  mults[idx] += mults[idx] + 1 > this.config.content.features.freeSpin.maxMultiplier ? 0 : 1;

                } else {
                  mults[idx] = 1;
                }
              }
            })
          }
        });
        console.log("multssss:", mults, freeSpinMultSymbols);

        playerState.gameSpecific.freeSpinMults = mults;
        // this.state.setGameSpecificState(
        //   userId,
        //   this.config.gameId,
        //   "freeSpins",
        //   freeSpinCount - 1 + (isFreeSpin ? this.config.content.features.freeSpin.incrementCount : 0)
        // );
        freeSpinCount = freeSpinCount - 1 + (isFreeSpin ? this.config.content.features.freeSpin.incrementCount : 0);
      }
      playerState.gameSpecific.freeSpins = freeSpinCount;

      console.log("reels", reels.map(row => row.map(symbolId => symbolId || "Unknown Symbol")));

      console.log(" spins awarded ", isFreeSpin, freeSpinCount);

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

      let totalWinAmount = 0

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
            //NOTE: freespin mults 
            //
            if (freeSpinCount > 0 && playerState.gameSpecific?.freeSpinMults) {

              if (freeSpinMultSymbols.includes(symbol.id)) {
                combinationsForSymbol.forEach((comb) => {
                  if (comb.payout && comb.payout > 0) {
                    comb.payout = comb.payout * playerState.gameSpecific.freeSpinMults[freeSpinMultSymbols.indexOf(symbol.id)];
                  }
                });

              }
            }
            winCombinations.push(...combinationsForSymbol);
            let winAmt: number = 0
            combinationsForSymbol.forEach((comb) => {
              if (comb.payout && comb.payout > 0) {
                winAmt += comb.payout
              }
            })
            totalWinAmount += winAmt;
          }
        }
      });

      // console.log("wincombs", JSON.stringify(winCombinations));

      if (totalWinAmount > 0) {
        // await this.creditWinnings(userId, totalWinAmount * totalBetAmount);
        playerState.balance += totalWinAmount * totalBetAmount;
      }
      console.log("win", totalWinAmount, playerState.balance);

      playerState.currentWinning = totalWinAmount * totalBetAmount;

      await this.state.updatePartialState(userId, this.config.gameId, playerState)

      return this.buildSpinResponse(
        reels,
        winCombinations,
        {
          isFreeSpin,
          count: freeSpinCount,
          mults: playerState.gameSpecific?.freeSpinMults || [1, 1, 1, 1, 1],
        },
        totalWinAmount,
        // newBalance,
        playerState.balance,
        payload.betAmount,
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

  private checkForFreespin(Context: SLLOLCheckForFreeSpinContext): boolean {
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
      mults: number[]
    },
    totalWinAmount: number,
    newBalance: number,
    betAmountIndex: number,
  ): SLLOLResponse {
    const betMultiplier = this.config.content.bets[betAmountIndex];

    // const features: any[] = []

    const spinResult = {
      id: "ResultData",
      payload: {
        winAmount: totalWinAmount * betMultiplier,
        wins: lineWins.map((win: WinningCombination) => {
          return {
            symbolId: win.symbolId,
            positions: win.positions,
            amount: win.payout * betMultiplier,
          };
        }),
      },
      features: {
        freeSpin: {
          isFreeSpin: specialFeatures?.isFreeSpin || false,
          count: specialFeatures?.count,
          mults: specialFeatures?.mults
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
