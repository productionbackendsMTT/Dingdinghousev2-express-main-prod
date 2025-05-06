import { GameEngine } from "../game.engine";
import { SlotAction, SlotConfig, SlotResponse } from "./base.slots.type";

class BaseSlotsEngine extends GameEngine<SlotConfig, SlotAction, SlotResponse> {
  validateConfig(): void {
    const { matrix, lines, symbols } = this.config.content;
    console.log("Validating config...");
  }

  async handleAction(action: SlotAction): Promise<SlotResponse> {
    switch (action.type) {
      case "spin":
        return this.handleSpin(action);
      default:
        throw new Error(`Unknown action: ${action.type}`);
    }
  }

  protected async handleSpin(action: SlotAction): Promise<SlotResponse> {
    const { userId, payload } = action;

    return this.state.withLock(
      `spin:${userId}:${this.config.gameId}`,
      async () => {
        // Validate balance and deduct bet
        const balance = await this.state.getBalance(userId, this.config.gameId);
        const totalBet = payload.betAmount * payload.lines;

        if (balance < totalBet) {
          return {
            success: false,
            balance,
            error: "Insufficient balance",
            // Add required properties even for error case
            reels: [],
            winAmount: 0,
            wins: [],
          };
        }

        // Deduct bet amount
        await this.state.deductBalance(userId, this.config.gameId, totalBet);

        // Generate spin result
        const result = await this.generateSpinResult(payload);

        // Credit wins if any
        if (result.winAmount && result.winAmount > 0) {
          await this.state.creditBalance(
            userId,
            this.config.gameId,
            result.winAmount
          );
        }

        // Get final balance
        const finalBalance = await this.state.getBalance(
          userId,
          this.config.gameId
        );

        // Ensure all required properties are included
        return {
          success: true,
          balance: finalBalance,
          reels: result.reels || [],
          winAmount: result.winAmount || 0,
          wins: result.wins || [],
          features: result.features,
        };
      }
    );
  }

  protected async generateSpinResult(
    bet: SlotAction["payload"]
  ): Promise<Partial<SlotResponse>> {
    const reels = this.generateReels();
    const wins = this.evaluateWins(reels, bet);
    const features = this.checkFeatures(reels);

    return {
      reels,
      winAmount: wins.total,
      wins: wins.lines,
      features,
    };
  }

  protected generateReels(): string[][] {
    // Base implementation - override in variants
    return [];
  }

  protected evaluateWins(reels: string[][], bet: SlotAction["payload"]) {
    // Base implementation - override in variants
    return { total: 0, lines: [] };
  }

  protected checkFeatures(reels: string[][]) {
    // Base implementation - override in variants
    return [];
  }
}

export default BaseSlotsEngine;
