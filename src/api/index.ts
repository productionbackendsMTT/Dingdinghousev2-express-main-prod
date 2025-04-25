import express, { Express, Router } from 'express';
import os from 'os';
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from './modules/auth/auth.route';
import roleRouter from './modules/roles/roles.routes';
import userRoutes from './modules/users/users.route';
import transactionRoutes from './modules/transactions/transactions.route';
import gamesRoutes from './modules/games/games.route';
import errorHandler from './middleware/error.middleware';
import { config } from '../common/config/config';

export default function api(app: Express) {

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());


    app.use(
        cors({
            origin: [config.clientUrl],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
            exposedHeaders: ["set-cookie"],
        })
    );

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
    router.use('/games', gamesRoutes);

    // Mount the API router to /api path
    app.use('/api', router);

    // Error handling middleware
    app.use(errorHandler);

    console.log('API routes initialized');
}