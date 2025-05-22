// src/modules/common/features/weightedPick.ts

/**
 * Given a “pool” array where each entry appears as many times as its weight,
 * pick one entry at random using the injected RNG.
 *
 * @param pool  Array of numbers (weights encoded as duplicates)
 * @param rng   Function returning a float in [0,1)
 */
export function getRandomFromProbability(probArray: number[], rng: () => number): number {
  try {

    const totalProb = probArray.reduce((sum, p) => sum + p, 0);
    const randValue = rng() * totalProb;

    let cumulativeProb = 0;
    for (let i = 0; i < probArray.length; i++) {
      cumulativeProb += probArray[i];
      if (randValue <= cumulativeProb) {
        return i + 1;
      }
    }

    return probArray.length;
  } catch (e) {
    console.log("error in getRandomFromProbability", e)
    return 0
  }
}
