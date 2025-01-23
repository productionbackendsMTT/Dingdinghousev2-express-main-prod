export enum UserRole {
    ADMIN = 'admin',
    SUPER_MASTER = 'super_master',
    MASTER = 'master',
    DISTRIBUTOR = 'distributor',
    SUB_DISTRIBUTOR = 'sub_distributor',
    STORE = 'store',
    PLAYER = 'player'
}

export const roleHierarchy = new Map<UserRole, UserRole[]>([
    [UserRole.ADMIN, [UserRole.SUPER_MASTER, UserRole.MASTER, UserRole.DISTRIBUTOR, UserRole.SUB_DISTRIBUTOR, UserRole.STORE, UserRole.PLAYER]],
    [UserRole.SUPER_MASTER, [UserRole.MASTER, UserRole.DISTRIBUTOR, UserRole.SUB_DISTRIBUTOR, UserRole.STORE]],
    [UserRole.MASTER, [UserRole.DISTRIBUTOR]],
    [UserRole.DISTRIBUTOR, [UserRole.SUB_DISTRIBUTOR]],
    [UserRole.SUB_DISTRIBUTOR, [UserRole.STORE]],
    [UserRole.STORE, [UserRole.PLAYER]],
    [UserRole.PLAYER, []]
]);