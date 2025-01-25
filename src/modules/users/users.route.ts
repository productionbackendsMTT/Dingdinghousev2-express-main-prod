import { Router } from "express";
import UserService from "./users.service";
import UserController from "./users.controller";
import { authHandler } from "../../middlewares";
import { checkPermission } from "../../middlewares/permission.middleware";
import { Resource } from "../../utils/resources";


const userRoutes = Router();
const userService = new UserService();
const userController = new UserController(userService);
const resource = Resource.USERS;

userRoutes.get('/me', authHandler, userController.getCurrentUser);
userRoutes.get('/me/descendants', authHandler, userController.getDescendants);
userRoutes.get('/:userId', authHandler, checkPermission(resource, 'r'), userController.getUserById);
userRoutes.get('/:userId/descendants', authHandler, checkPermission(resource, 'r'), userController.getDescendantsOfUser);
userRoutes.get('/:userId/report', authHandler, checkPermission(resource, 'r'), userController.getUserReport);
userRoutes.put('/:userId', authHandler, checkPermission(resource, 'w'), userController.updateUser);
userRoutes.delete('/:userId', authHandler, checkPermission(resource, 'x'), userController.deleteUser);

export default userRoutes;