import { Request, Response, NextFunction } from "express";
import TransactionService from "./transactions.service";
import mongoose from "mongoose";
import { successResponse } from "../../utils";
import { TransactionType } from "./transactions.model";
import { AuthRequest } from "../../middlewares";
import createHttpError from "http-errors";

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
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError.NotFound("User not found");
            }

            const {
                page = "1",
                limit = "10",
                from,
                to,
                type,
                amount,
                amountOp, // gt, lt, eq
                sortBy = "createdAt",
                sortOrder = "desc",
                search = ""
            } = req.query;

            // Build filters object
            const queryFilters: any = {};

            // Add search filter
            if (search) {
                queryFilters.search = search;
            }

            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from) queryFilters.createdAt.$gte = new Date(from as string);
                if (to) queryFilters.createdAt.$lte = new Date(to as string);
            }

            // Add transaction type filter
            if (type) {
                queryFilters.type = type;
            }

            // Add amount filter
            if (amount) {
                const amountValue = parseFloat(amount as string);
                if (!isNaN(amountValue)) {
                    switch (amountOp) {
                        case "gt":
                            queryFilters.amount = { $gt: amountValue };
                            break;
                        case "lt":
                            queryFilters.amount = { $lt: amountValue };
                            break;
                        case "eq":
                            queryFilters.amount = amountValue;
                            break;
                    }
                }
            }

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10),
                sort: { [sortBy as string]: sortOrder === "desc" ? -1 : 1 }
            };


            const result = await this.transactionService.getByUserAndDescendants(
                requestingUser._id,
                queryFilters,
                options
            );

            res.status(200).json(successResponse(result.data, 'Transactions retrieved successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }

    async getTransactionsByUserAndDescendants(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;
            const {
                page = "1",
                limit = "10",
                from,
                to,
                type,
                amount,
                amountOp, // gt, lt, eq
                sortBy = "createdAt",
                sortOrder = "desc",
                search = ""
            } = req.query;

            // Build filters object
            const queryFilters: any = {};

            // Add search filter
            if (search) {
                queryFilters.search = search;
            }

            // Add date range filter
            if (from || to) {
                queryFilters.createdAt = {};
                if (from) queryFilters.createdAt.$gte = new Date(from as string);
                if (to) queryFilters.createdAt.$lte = new Date(to as string);
            }

            // Add transaction type filter
            if (type) {
                queryFilters.type = type;
            }

            // Add amount filter
            if (amount) {
                const amountValue = parseFloat(amount as string);
                if (!isNaN(amountValue)) {
                    switch (amountOp) {
                        case "gt":
                            queryFilters.amount = { $gt: amountValue };
                            break;
                        case "lt":
                            queryFilters.amount = { $lt: amountValue };
                            break;
                        case "eq":
                            queryFilters.amount = amountValue;
                            break;
                    }
                }
            }

            const options = {
                page: parseInt(page as string, 10),
                limit: parseInt(limit as string, 10),
                sort: { [sortBy as string]: sortOrder === "desc" ? -1 : 1 }
            };


            const result = await this.transactionService.getByUserAndDescendants(
                new mongoose.Types.ObjectId(userId),
                queryFilters,
                options
            );

            res.status(200).json(successResponse(result.data, 'Transactions retrieved successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }
}

export default TransactionController;