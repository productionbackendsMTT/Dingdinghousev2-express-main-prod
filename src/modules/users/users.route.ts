import { Router } from "express";
import UserService from "./users.service";
import UserController from "./users.controller";
import { authHandler, checkPermission } from "../../middlewares";
import { Resource } from "../../utils/resources";


const userRoutes = Router();
const userService = new UserService();
const userController = new UserController(userService);
const resource = Resource.USERS;

userRoutes.get('/me', authHandler, userController.getCurrentUser);
userRoutes.get('/me/descendants', authHandler, checkPermission(resource, 'r'), userController.getDescendants);
userRoutes.get("/me/report", authHandler, checkPermission(resource, 'r'), userController.getDescendantsReport);

userRoutes.get('/:userId', authHandler, checkPermission(resource, 'r'), userController.getUserById);
userRoutes.put('/:userId', authHandler, checkPermission(resource, 'w'), userController.updateUser);
userRoutes.delete('/:userId', authHandler, checkPermission(resource, 'x'), userController.deleteUser);
userRoutes.get('/:userId/favourite-games', authHandler, checkPermission(resource, 'r'), userController.getUserFavouriteGames);
userRoutes.patch('/:userId/favourite-games', authHandler, checkPermission(resource, 'w'), userController.updateFavouriteGames);
userRoutes.get('/:userId/descendants', authHandler, checkPermission(resource, 'r'), userController.getDescendantsOfUser);
userRoutes.get('/:userId/permissions', authHandler, checkPermission(resource, 'r'), userController.getUserPermissions);
userRoutes.patch('/:userId/permissions', authHandler, checkPermission(resource, 'w'), userController.updateUserPermissions);
userRoutes.get('/:userId/report', authHandler, checkPermission(resource, 'r'), userController.getUserReport);


export default userRoutes;