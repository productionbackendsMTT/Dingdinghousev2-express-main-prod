import RoleModel from "../../modules/roles/roles.model";
import UserModel from "../../modules/users/users.model";

export async function initializeSystem() {
    try {
        await RoleModel.ensureRoleHierarchy();
        await UserModel.ensureRootUser();
    } catch (error) {
        console.error('Failed to initialize system:', error);
        throw error;
    }
}
