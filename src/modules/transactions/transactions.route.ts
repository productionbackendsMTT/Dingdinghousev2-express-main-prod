import { Router } from "express";
import TransactionController from "./transactions.controller";
import TransactionService from "./transactions.service";

const transactionRoutes = Router();
const transactionService = new TransactionService();
const transactionController = new TransactionController(transactionService);

transactionRoutes.get("/:transactionId", transactionController.getTransactionById);
transactionRoutes.get("/user/:userId", transactionController.getTransactionsByUser);
transactionRoutes.get('/', transactionController.getAllTransactions);
transactionRoutes.get('/user/:userId/descendants', transactionController.getTransactionsByUserAndDescendants);

export default transactionRoutes;