import { Request, Response, NextFunction } from "express";
import TransactionService from "./transactions.service";
import mongoose from "mongoose";
import { successResponse } from "../../utils";
import { TransactionType } from "./transactions.model";

class TransactionController {
    constructor(private transactionService: TransactionService) {
        this.getAllTransactions = this.getAllTransactions.bind(this);
        this.getTransactionById = this.getTransactionById.bind(this);
        this.getTransactionsByUser = this.getTransactionsByUser.bind(this);
        this.getTransactionsByUserAndDescendants = this.getTransactionsByUserAndDescendants.bind(this);

    }

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
            const { page = "1", limit = "10", ...filters } = req.query;

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10)
            };


            const result = await this.transactionService.getByUser(
                new mongoose.Types.ObjectId(userId),
                filters,
                options
            );
            res.status(200).json(successResponse(result.data, 'Transactions retrieved successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }

    async getAllTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const { page = "1", limit = "10", startDate, endDate, type, sender, receiver, amount, sortBy = "createdAt", sortOrder = "desc", search } = req.query;
            const filters: any = {};

            // Date range filter
            if (startDate || endDate) {
                filters.createdAt = {};
                if (startDate) filters.createdAt.$gte = new Date(startDate as string);
                if (endDate) filters.createdAt.$lte = new Date(endDate as string);
            }

            // Exact matches
            if (type && Object.values(TransactionType).includes(type as TransactionType)) {
                filters.type = type;
            }
            if (sender) filters.sender = new mongoose.Types.ObjectId(sender as string);
            if (receiver) filters.receiver = new mongoose.Types.ObjectId(receiver as string);
            if (amount) filters.amount = parseFloat(amount as string);


            // Search filter for ObjectIds
            if (search) {
                if (mongoose.Types.ObjectId.isValid(search as string)) {
                    filters.$or = [
                        { sender: new mongoose.Types.ObjectId(search as string) },
                        { receiver: new mongoose.Types.ObjectId(search as string) }
                    ];
                }
            }

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10),
                sort: { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 }
            };

            const result = await this.transactionService.getAll(filters, options);
            res.status(200).json(successResponse(result.data, 'Transactions retrieved successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }

    async getTransactionsByUserAndDescendants(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const { page = "1", limit = "10", ...filters } = req.query;

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10)
            };


            const result = await this.transactionService.getByUserAndDescendants(
                new mongoose.Types.ObjectId(userId),
                filters,
                options
            );
            res.status(200).json(successResponse(result.data, 'Transactions retrieved successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }
}

export default TransactionController;