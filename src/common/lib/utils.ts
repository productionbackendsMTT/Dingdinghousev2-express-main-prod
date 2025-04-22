import { roleHierarchy } from "./default-role-hierarchy";

export function getAncestorRoles(roleName: string): string[] {
    return Object.keys(roleHierarchy).filter(parentRole =>
        roleHierarchy[parentRole].includes(roleName)
    );
}