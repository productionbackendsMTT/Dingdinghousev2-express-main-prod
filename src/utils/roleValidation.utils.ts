import createHttpError from "http-errors";
import { roleHierarchy, UserRole } from "../config/hierarchy"


export const validateUserRole = (requestingUserRole: UserRole, targetUserRole: UserRole) => {
    const allowedRoles = roleHierarchy.get(requestingUserRole);
    if (!allowedRoles || !allowedRoles.includes(targetUserRole)) {
        throw createHttpError(403, `Access denied : ${requestingUserRole} cannot create ${targetUserRole}`);
    }
};