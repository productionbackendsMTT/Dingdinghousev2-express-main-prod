import { Router } from "express";
import AuthController from "./auth.controller";
import AuthService from "./auth.service";
import { authHandler } from "../../middlewares";

const authRoutes = Router();
const authService = new AuthService();
const authController = new AuthController(authService);

authRoutes.post('/login', authController.login);
authRoutes.post('/logout', authHandler, authController.logout)
authRoutes.post('/register', authHandler, authController.register);
authRoutes.post('/refresh-token', authController.refreshAccessToken);

export default authRoutes;