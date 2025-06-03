// src/modules/common/features/paylines.ts

/**
 * Evaluate which paylines hit on a given result matrix.
 *
 * Supports matching a payline pattern both left-to-right and right-to-left.
 *
 * @param matrix    2D array [row][col] of symbol IDs
 * @param paylines  Array of payline definitions; each is an array of row-indices length == #columns
 * @returns         Array of payline paths that matched; each path is an array of row-indices.
 */
export function evaluatePaylines(
  matrix: number[][],
  paylines: number[][],
): number[][] {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const hits: number[][] = [];

  for (const pattern of paylines) {
    if (pattern.length !== cols) {
      console.warn(
        `Skipping payline pattern of length ${pattern.length}, expected ${cols}`,
      );
      continue;
    }

    // Helper to test a path-of-play: returns true if all symbols along it are equal
    const testPath = (path: number[]): boolean => {
      const firstSym = matrix[path[0]][0];
      for (let col = 1; col < cols; col++) {
        if (matrix[path[col]][col] !== firstSym) return false;
      }
      return true;
    };

    // 1) Left-to-right
    if (testPath(pattern)) {
      hits.push(pattern);
    }

    // 2) Right-to-left: reverse the pattern across columns
    const reversedPattern = pattern.slice().reverse();
    if (
      // avoid double-pushing palindromic lines
      !pattern.every((rowIdx, i) => rowIdx === reversedPattern[i]) &&
      testPath(reversedPattern)
    ) {
      hits.push(reversedPattern);
    }
  }

  return hits;
}
