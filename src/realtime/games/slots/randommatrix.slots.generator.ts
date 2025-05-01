import { functionUsedConfig, SlotConfig } from "./base.slots.type";
import { generatetrueRandomNumber } from "./gameUtils.slots";
export class RandomResultGenerator {
    protected slotConfig!: SlotConfig;

    constructor(slotConfig: SlotConfig, functionConfig: functionUsedConfig) {
        // Validate settings
        if (!slotConfig.matrix.x || !slotConfig.matrix.y) {
            throw new Error("Invalid game settings provided.");
        }
        const { x, y } = slotConfig.matrix;
        const reels = functionConfig.reels;
        let matrix: string[][] = [];
        for (let col = 0; col < x; col++) {
            const startPosition = this.getRandomIndex(functionConfig.reels[col].length - 1);
            for (let row = 0; row < y; row++) {
                if (!matrix[row]) matrix[row] = [];
                matrix[row][col] = functionConfig.reels[col][(startPosition + row) % functionConfig.reels[col].length];
            }
        }
        // Log the generated matrix for debugging
        this.logMatrix(matrix);
        functionConfig.resultReelIndex = matrix;
        functionConfig.resultSymbolMatrix = this.shuffleMatrix(matrix);
    }

    private getRandomIndex(maxValue: number): number {
        const seed = Date.now() + Math.random() * 1000;
        return Math.floor(generatetrueRandomNumber(maxValue + 1))

    }

    private logMatrix(matrix: string[][]): void {
        console.log("Generated Symbol Matrix:");
        matrix.forEach(row => console.log(row.join(" ")));
    }

    private shuffleMatrix(matrix: string[][]): string[][] {
        return matrix.map(row => this.shuffleArray(row));
    }

    private shuffleArray(array: string[]): string[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
