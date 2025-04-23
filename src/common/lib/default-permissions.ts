import { Roles } from "./default-role-hierarchy";
import { Resource } from "./resources";

export const defaultPermission = {
    [Roles.ROOT]: {
        [Resource.USERS]: "rwx",
        [Resource.TRANSACTIONS]: "rwx",
        [Resource.REPORTS]: "rwx",
        [Resource.GAMES]: "rwx",
        [Resource.ROLES]: "rwx"
    },
    [Roles.ADMIN]: {
        [Resource.USERS]: "rwx",
        [Resource.TRANSACTIONS]: "rwx",
        [Resource.REPORTS]: "rwx",
        [Resource.GAMES]: "rwx",
        [Resource.ROLES]: "r--",
    },
    [Roles.STORE]: {
        [Resource.USERS]: "rwx",
        [Resource.TRANSACTIONS]: "rwx",
        [Resource.REPORTS]: "r--",
        [Resource.GAMES]: "r--",
        [Resource.ROLES]: "r--",
    },
    [Roles.PLAYER]: {
        [Resource.USERS]: "r--",
        [Resource.TRANSACTIONS]: "r--",
        [Resource.REPORTS]: "---",
        [Resource.GAMES]: "r--",
        [Resource.ROLES]: "r--",
    },
};