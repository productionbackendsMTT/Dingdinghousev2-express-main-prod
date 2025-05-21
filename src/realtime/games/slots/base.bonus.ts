import { BonusFeature } from "./base.slots.type"
import { weightedRandomPick } from "./common/weightedPick"


interface SpinResponse {
  BonusStopIndex: number
}
export function checkSpinBonus(count: BonusFeature["minSymbolCount"], matrix: string[][], bonusSymbol: string): boolean {
  if (count === undefined || count === null || count < 0) {
    console.error("Bonus feature minSymbolCount is invalid in spin bonus check")
    return false
  }
  let found = 0
  matrix.forEach((row, rowIndex) => {
    row.forEach((symbol, columnIndex) => {
      if (symbol === bonusSymbol) {
        found++
      }
    })
  })
  return found >= count

}
export function calculateSpinBonus(payout: BonusFeature["payout"]): SpinResponse {
  let pool: number[] = []
  payout.forEach((item) => {
    pool.push(item.probability)
  })
  // weightedRandomPick(pool, cryptoRandom)


  return {
    BonusStopIndex: 0
  }

}
