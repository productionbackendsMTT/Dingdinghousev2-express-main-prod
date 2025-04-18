import { Router } from "express";
import RoleService from "./roles.service";
import RoleController from "./roles.controller";
import { authHandler, checkPermission } from "../../middlewares";
import { Resource } from "../../utils";

const roleRouter = Router();
const roleService = new RoleService();
const roleController = new RoleController(roleService);
const resource = Resource.ROLES;

roleRouter.post('/', authHandler, checkPermission(resource, 'w'), roleController.addRole);
roleRouter.get('/', authHandler, checkPermission(resource, 'r'), roleController.getAllRoles);
roleRouter.get('/:roleId', authHandler, checkPermission(resource, 'r'), roleController.getRoleById);
roleRouter.patch('/:roleId', authHandler, checkPermission(resource, 'w'), roleController.updateRole);
roleRouter.delete('/:roleId', authHandler, checkPermission(resource, 'x'), roleController.deleteRole);

export default roleRouter;