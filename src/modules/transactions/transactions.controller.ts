import { Request, Response, NextFunction } from "express";
import TransactionService from "./transactions.service";
import mongoose from "mongoose";
import { successResponse } from "../../utils";

class TransactionController {
    constructor(private transactionService: TransactionService) { }

    async getTransactionById(req: Request, res: Response, next: NextFunction) {
        try {
            const { transactionId } = req.params;
            const transaction = await this.transactionService.getById(new mongoose.Types.ObjectId(transactionId));
            res.status(200).json(successResponse(transaction));
        } catch (error) {
            next(error);
        }
    }

    async getTransactionsByUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const transactions = await this.transactionService.getByUser(new mongoose.Types.ObjectId(userId));
            res.status(200).json(successResponse(transactions));
        } catch (error) {
            next(error);
        }
    }

    async getAllTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const transactions = await this.transactionService.getAll();
            res.status(200).json(successResponse(transactions));
        } catch (error) {
            next(error);
        }
    }

    async getTransactionsByUserAndDescendants(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const transactions = await this.transactionService.getByUserAndDescendants(new mongoose.Types.ObjectId(userId));
            res.status(200).json(successResponse(transactions));
        } catch (error) {
            next(error);
        }
    }
}

export default TransactionController;