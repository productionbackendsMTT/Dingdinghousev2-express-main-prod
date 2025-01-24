import { Router } from "express";
import UserService from "./users.service";
import UserController from "./users.controller";
import { authHandler } from "../../middlewares";


const userRoutes = Router();
const userService = new UserService();
const userController = new UserController(userService);

userRoutes.get('/me', authHandler, userController.getCurrentUser);
userRoutes.get('/me/descendants', authHandler, userController.getDescendants);
userRoutes.get('/:userId', authHandler, userController.getUserById);
userRoutes.get('/:userId/descendants', authHandler, userController.getDescendantsOfUser);
userRoutes.get('/:userId/report', authHandler, userController.getUserReport);
userRoutes.put('/:userId', authHandler, userController.updateUser);
userRoutes.delete('/:userId', authHandler, userController.deleteUser);

export default userRoutes;