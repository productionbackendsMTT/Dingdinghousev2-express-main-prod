// src/modules/common/features/weightedPick.ts

/**
 * Given a “pool” array where each entry appears as many times as its weight,
 * pick one entry at random using the injected RNG.
 *
 * @param pool  Array of items (weights encoded as duplicates)
 * @param rng   Function returning a float in [0,1)
 */
export function weightedRandomPick<T>(pool: T[], rng: () => number): T {
  if (pool.length === 0) {
    throw new Error("Cannot pick from an empty pool");
  }
  const idx = Math.floor(rng() * pool.length);
  return pool[idx];
}
