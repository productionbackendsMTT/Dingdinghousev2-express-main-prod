export enum Roles {
    ROOT = "root",
    ADMIN = "admin",
    STORE = "store",
    PLAYER = "player",
}

export const roleHierarchy: Record<string, string[]> = {
    [Roles.ROOT]: [Roles.ADMIN, Roles.STORE, Roles.PLAYER],
    [Roles.ADMIN]: [Roles.STORE, Roles.PLAYER],
    [Roles.STORE]: [Roles.PLAYER],
    [Roles.PLAYER]: [],
};
