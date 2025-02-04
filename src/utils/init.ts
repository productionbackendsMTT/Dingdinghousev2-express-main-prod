import RoleModel from "../modules/roles/roles.model";
import { UserModel } from "../modules/users";

export async function initializeSystem() {
    try {
        await RoleModel.ensureAdminRole();
        await RoleModel.ensurePlayerRole()
        await UserModel.ensureAdminUser();
    } catch (error) {
        console.error('Failed to initialize system:', error);
        throw error;
    }
}
