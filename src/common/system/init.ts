import RoleModel from "../../api/modules/roles/roles.model";
import UserModel from "../../api/modules/users/users.model";

export async function init() {
    try {
        await RoleModel.ensureRoleHierarchy();
        await UserModel.ensureRootUser();
    } catch (error) {
        console.error('Failed to initialize system:', error);
        throw error;
    }
}
