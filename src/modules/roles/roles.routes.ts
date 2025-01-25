import { Router } from "express";
import RoleService from "./roles.service";
import RoleController from "./roles.controller";
import { checkPermission } from "../../middlewares/permission.middleware";
import { Resource } from "../../utils/resources";
import { authHandler } from "../../middlewares";

const roleRouter = Router();
const roleService = new RoleService();
const roleController = new RoleController(roleService);
const resource = Resource.ROLES;

roleRouter.post('/', authHandler, checkPermission(resource, 'w'), roleController.addRole);
roleRouter.get('/', authHandler, checkPermission(resource, 'r'), roleController.getAllRoles);
roleRouter.get('/:id', authHandler, checkPermission(resource, 'r'), roleController.getRoleById);
roleRouter.patch('/:id/name', authHandler, checkPermission(resource, 'w'), roleController.updateRoleName);
roleRouter.patch('/:id/descendants', authHandler, checkPermission(resource, 'w'), roleController.updateDescendants);
roleRouter.delete('/:id', authHandler, checkPermission(resource, 'x'), roleController.deleteRole);

export default roleRouter;