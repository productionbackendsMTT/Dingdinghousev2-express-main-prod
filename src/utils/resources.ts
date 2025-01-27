import { ADMIN_ROLE_NAME } from "../modules/roles/roles.types";

export enum Resource {
    USERS = 'users',
    TRANSACTIONS = 'transactions',
    REPORTS = 'reports',
    GAMES = 'games',
    ROLES = 'roles',
}

export interface IResourcePermission {
    resource: Resource;
    permission: string; // "rwx", "r--", "rw-", etc.
}

export const DEFAULT_ADMIN_PERMISSION = 'rwx';
export const DEFAULT_USER_PERMISSION = 'r--';
export const PERMISSION_PATTERN = /^[r-][w-][x-]$/;

export const generateDefaultPermissions = (role: string) => {
    return Object.values(Resource).map(resource => ({
        resource,
        permission: role === ADMIN_ROLE_NAME ? DEFAULT_ADMIN_PERMISSION : DEFAULT_USER_PERMISSION
    }))
}