import { GameConfig } from "../../../(Slot)/utils/GameConfig";
import { BaseKenoGame } from "../../core/base.keno";
import DefaultKenoGame from "../../core/default.keno";
export class KNCM extends BaseKenoGame {
    private defaultSlotGame: DefaultKenoGame;

    constructor(config: GameConfig) {
        super(config);
        this.defaultSlotGame = new DefaultKenoGame(config);
    }

    spin(): void {
        this.log("Spinning the Keno Machine Slot...");
        this.defaultSlotGame.spin();
    }

    evaluateResult(resultMatrix: number[][]): void {
        this.log("Evaluating results in SLCM...");
        this.defaultSlotGame.evaluateResult(resultMatrix);
    }
}

export default KNCM;
