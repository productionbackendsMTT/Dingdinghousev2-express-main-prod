import { Router } from 'express';
import authRoutes from './auth/auth.route';
import userRoutes from './users/users.route';
import transactionRoutes from './transactions/transactions.route';
import roleRouter from './roles/roles.routes';

const moduleRoutes = Router();

// Register module specific routes
moduleRoutes.use('/auth', authRoutes);
moduleRoutes.use('/roles', roleRouter);
moduleRoutes.use("/users", userRoutes);
moduleRoutes.use('/transactions', transactionRoutes)

export default moduleRoutes;