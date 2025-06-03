import { BonusFeature } from "./base.slots.type"
import { getRandomFromProbability } from "./common/weightedPick"
import { cryptoRng } from "./gameUtils.slots"


interface SpinBonusResponse {
  BonusStopIndex: number
}
/**
 * Checks if the number of bonus symbols in the matrix meets or exceeds the minimum required count.
 * @param count - The minimum number of bonus symbols required.
 * @param matrix - The slot matrix to check, represented as a 2D array of strings.
 * @param bonusSymbol - The symbol representing the bonus.
 * @returns True if the count of bonus symbols is greater than or equal to the required count, otherwise false.
 */
export function checkSpinBonus(count: BonusFeature["minSymbolCount"], matrix: string[][], bonusSymbol: string): boolean {
  if (count === undefined || count === null || count < 0) {
    console.error("Bonus feature minSymbolCount is invalid in spin bonus check")
    return false
  }
  let found = 0
  matrix.forEach((row) => {
    row.forEach((symbol) => {
      if (symbol === bonusSymbol) {
        found++
      }
    })
  })
  return found >= count

}
/**
 * Calculates the bonus stop index based on the payout probabilities.
 * @param payout - An array of payout objects, each containing a probability.
 * @returns An object containing the randomly selected bonus stop index.
 */
export function calculateSpinBonus(payout: BonusFeature["payout"]): SpinBonusResponse {
  let pool: number[] = []
  payout.forEach((item) => {
    pool.push(item.probability)
  })

  return {
    BonusStopIndex: getRandomFromProbability(pool, cryptoRng) - 1
  }

}

