import { Router } from "express";
import UserService from "./users.service";
import UserController from "./users.controller";
import { authHandler } from "../../middlewares";


const userRoutes = Router();
const userService = new UserService();
const userController = new UserController(userService);

userRoutes.get('/me', authHandler, userController.getCurrentUser);
userRoutes.get('/descendants', authHandler, userController.getDescendants);
userRoutes.delete('/:userId', authHandler, userController.delete);

export default userRoutes;