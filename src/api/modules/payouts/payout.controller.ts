import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { PayoutService } from "./payout.service";

export class PayoutController {

    constructor(private payoutService: PayoutService) {
        this.createPayout = this.createPayout.bind(this);
        this.activatePayout = this.activatePayout.bind(this);
        this.getPayoutsByGame = this.getPayoutsByGame.bind(this);
        this.getActivePayout = this.getActivePayout.bind(this);
        this.updatePayout = this.updatePayout.bind(this);
        this.deletePayout = this.deletePayout.bind(this);

     }

    // Create a new payout
    async createPayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { gameId, content, version } = req.body;
            const payout = await this.payoutService.createPayout(gameId, content, version);
            res.status(201).json(payout);
        } catch (error) {
            next(error);
        }
    }

    // Activate a payout
    async activatePayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { payoutId } = req.params;
            const payout = await this.payoutService.activatePayout(payoutId);
            res.status(200).json(payout);
        } catch (error) {
            next(error);
        }
    }

    // Get all payouts for a game
    async getPayoutsByGame(req: Request, res: Response, next: NextFunction) {
        try {
            const { gameId } = req.params;
            const payouts = await this.payoutService.getPayoutByGame(gameId);
            res.status(200).json(payouts);
        } catch (error) {
            next(error);
        }
    }

    // Get the active payout for a game
    async getActivePayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { gameId } = req.params;
            const payout = await this.payoutService.getActivePayout(gameId);
            if (!payout) {
                throw createHttpError.NotFound("No active payout found for this game");
            }
            res.status(200).json(payout);
        } catch (error) {
            next(error);
        }
    }

    // Update a payout
    async updatePayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { payoutId } = req.params;
            const { content } = req.body;
            const payout = await this.payoutService.updatePayout(payoutId, content);
            res.status(200).json(payout);
        } catch (error) {
            next(error);
        }
    }

    // Delete a payout
    async deletePayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { payoutId } = req.params;
            await this.payoutService.deletePayout(payoutId);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}