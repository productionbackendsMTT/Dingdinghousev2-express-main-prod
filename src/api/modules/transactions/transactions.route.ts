import { Router } from "express";
import TransactionController from "./transactions.controller";
import TransactionService from "./transactions.service";
import { authHandler } from "../../middleware/auth.middleware";
import { checkPermission } from "../../middleware/permission.middleware";
import { Resource } from "../../../common/lib/resources";

const transactionRoutes = Router();
const transactionService = new TransactionService();
const transactionController = new TransactionController(transactionService);
const resource = Resource.TRANSACTIONS;


transactionRoutes.get('/', authHandler, checkPermission(resource, 'r'), transactionController.getAllTransactions);
transactionRoutes.get("/:transactionId", authHandler, checkPermission(resource, 'r'), transactionController.getTransactionById);
transactionRoutes.get("/user/:userId", authHandler, checkPermission(resource, 'r'), transactionController.getTransactionsByUser);
transactionRoutes.get('/user/:userId/descendants', authHandler, checkPermission(resource, 'r'), transactionController.getTransactionsByUserAndDescendants);

export default transactionRoutes;