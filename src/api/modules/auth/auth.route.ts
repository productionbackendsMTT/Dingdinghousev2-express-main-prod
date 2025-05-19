import { Router } from "express";
import AuthController from "./auth.controller";
import AuthService from "./auth.service";
import { authHandler, sseAuthHandler } from "../../middleware/auth.middleware";
import { checkPermission } from "../../middleware/permission.middleware";
import { Resource } from "../../../common/lib/resources";

const authRoutes = Router();
const authService = new AuthService();
const authController = new AuthController(authService);

authRoutes.get("/events", sseAuthHandler, authController.sendEvents);
authRoutes.post("/login", authController.login);
authRoutes.post("/logout", authHandler, authController.logout);
authRoutes.post(
  "/register",
  authHandler,
  checkPermission(Resource.USERS, "w"),
  authController.register
);
authRoutes.post("/refresh-token", authController.refreshAccessToken);

export default authRoutes;
