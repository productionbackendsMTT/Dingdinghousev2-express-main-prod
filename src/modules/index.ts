import { Router } from 'express';
import authRoutes from './auth/auth.route';
import userRoutes from './users/users.route';

const moduleRoutes = Router();

// Register module specific routes
moduleRoutes.use('/auth', authRoutes);
moduleRoutes.use("/users", userRoutes)

export default moduleRoutes;