
import { BaseSlotGame } from "./base.slot";


export class DefaultSlotGame extends BaseSlotGame {
  spin() {
    this.log("Spinning the reels...");
    const resultMatrix = this.generateRandomMatrix();
    this.log(`Spin result: ${JSON.stringify(resultMatrix)}`);
    this.evaluateResult(resultMatrix);
    return JSON.stringify(resultMatrix)
  }

  evaluateResult(resultMatrix: number[][]) {
    const winLines = this.calculateWinLines(resultMatrix);
    this.log(`Winning lines: ${JSON.stringify(winLines)}`);
    if (winLines.length > 0) {
      this.log(`You won on ${winLines.length} line(s)!`);
    } else {
      this.log("No win this time. Try again!");
    }
  }

  private generateRandomMatrix(): number[][] {
    const { matrix, Symbols } = this.config;
    const result: number[][] = [];

    for (let row = 0; row < matrix.y; row++) {
      const reel: number[] = [];
      for (let col = 0; col < matrix.x; col++) {
        const symbolIndex = Math.floor(Math.random() * Symbols.length);
        reel.push(Symbols[symbolIndex].Id);
      }
      result.push(reel);
    }

    return result;
  }

  private calculateWinLines(resultMatrix: number[][]): number[][] {
    const { linesApiData } = this.config;
    const winLines: number[][] = [];
    linesApiData.forEach((line) => {
      const firstSymbol = resultMatrix[line[0]][0];
      const isWinningLine = line.every((pos, index) => {
        const reelIndex = line[index];
        return resultMatrix[reelIndex][index] === firstSymbol;
      });

      if (isWinningLine) {
        winLines.push(line);
      }
    });

    return winLines;
  }
}

