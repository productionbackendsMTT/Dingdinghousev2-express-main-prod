import Role from "../schemas/role.schema";
import User from "../schemas/user.schema";

export async function init() {
    try {
        await Role.ensureRoleHierarchy();
        await User.ensureRootUser();
    } catch (error) {
        console.error('Failed to initialize system:', error);
        throw error;
    }
}
