import { Router } from 'express';
import userRoutes from './users/users.route';
import transactionRoutes from './transactions/transactions.route';
import roleRouter from './roles/roles.routes';
import gamesRoutes from './games/games.route';
import authRoutes from './auth/auth.route';

const moduleRoutes = Router();

// Register module specific routes
moduleRoutes.use('/auth', authRoutes);
moduleRoutes.use('/roles', roleRouter);
moduleRoutes.use("/users", userRoutes);
moduleRoutes.use('/transactions', transactionRoutes);
moduleRoutes.use('/games', gamesRoutes)


export default moduleRoutes;