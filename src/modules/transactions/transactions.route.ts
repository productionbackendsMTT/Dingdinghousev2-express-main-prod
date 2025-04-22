import { Router } from "express";
import TransactionController from "./transactions.controller";
import TransactionService from "./transactions.service";
import { Resource } from "../../common/lib/resources";
import { authHandler } from "../../common/middlewares/auth.middleware";
import { checkPermission } from "../../common/middlewares/permission.middleware";

const transactionRoutes = Router();
const transactionService = new TransactionService();
const transactionController = new TransactionController(transactionService);
const resource = Resource.TRANSACTIONS;


transactionRoutes.get('/', authHandler, checkPermission(resource, 'r'), transactionController.getAllTransactions);
transactionRoutes.get("/:transactionId", authHandler, checkPermission(resource, 'r'), transactionController.getTransactionById);
transactionRoutes.get("/user/:userId", authHandler, checkPermission(resource, 'r'), transactionController.getTransactionsByUser);
transactionRoutes.get('/user/:userId/descendants', authHandler, checkPermission(resource, 'r'), transactionController.getTransactionsByUserAndDescendants);

export default transactionRoutes;