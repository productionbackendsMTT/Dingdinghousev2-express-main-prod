import { Router } from "express";
import AuthController from "./auth.controller";
import AuthService from "./auth.service";
import { authHandler, checkPermission } from "../../middlewares";
import { Resource } from "../../utils";

const authRoutes = Router();
const authService = new AuthService();
const authController = new AuthController(authService);

authRoutes.post('/login', authController.login);
authRoutes.post('/logout', authHandler, authController.logout)
authRoutes.post('/register', authHandler, checkPermission(Resource.USERS, 'w'), authController.register);
authRoutes.post('/refresh-token', authController.refreshAccessToken);

export default authRoutes;