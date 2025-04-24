import { Express, Router } from 'express';
import os from 'os';
import authRoutes from './modules/auth/auth.route';
import roleRouter from './modules/roles/roles.routes';
import userRoutes from './modules/users/users.route';
import transactionRoutes from './modules/transactions/transactions.route';
import gamesRoutes from './modules/games/games.route';
import errorHandler from './middleware/error.middleware';

export default function api(app: Express) {
    // Create main router for all API routes
    const router = Router();

    // Root endpoint
    app.get('/', (req, res) => {
        const response = {
            uptime: os.uptime(),
            timestamp: new Date().toISOString(),
            message: 'Server is running...'
        };
        res.json(response);
    });

    // Register module specific routes
    router.use('/auth', authRoutes);
    router.use('/roles', roleRouter);
    router.use('/users', userRoutes);
    router.use('/transactions', transactionRoutes);
    router.use('/game', gamesRoutes);

    // Mount the API router to /api path
    app.use('/api', router);

    // Error handling middleware
    app.use(errorHandler);

    console.log('API routes initialized');
}