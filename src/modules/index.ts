import { Router } from 'express';
import userRoutes from './users/users.route';
import transactionRoutes from './transactions/transactions.route';
import { authRoutes } from './auth';
import roleRouter from './roles/roles.routes';

const moduleRoutes = Router();

// Register module specific routes
moduleRoutes.use('/auth', authRoutes);
moduleRoutes.use('/roles', roleRouter);
moduleRoutes.use("/users", userRoutes);
moduleRoutes.use('/transactions', transactionRoutes)


export default moduleRoutes;