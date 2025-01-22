import { Router } from "express";
import UserService from "./users.service";
import UserController from "./users.controller";


const userRoutes = Router();
const userService = new UserService();
const userController = new UserController(userService);

userRoutes.delete('/:userId', userController.delete)

export default userRoutes;