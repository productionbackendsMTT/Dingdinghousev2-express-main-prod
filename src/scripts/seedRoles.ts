import mongoose from "mongoose";
import { config } from "../config/config";
import RoleModel from "../modules/roles/roles.model";

enum UserRole {
    ADMIN = 'admin',
    SUPER_MASTER = 'super_master',
    MASTER = 'master',
    DISTRIBUTOR = 'distributor',
    SUB_DISTRIBUTOR = 'sub_distributor',
    STORE = 'store',
    PLAYER = 'player'
}

const hierarchy = new Map<UserRole, UserRole[]>([
    [UserRole.ADMIN, [UserRole.SUPER_MASTER, UserRole.MASTER, UserRole.DISTRIBUTOR, UserRole.SUB_DISTRIBUTOR, UserRole.STORE, UserRole.PLAYER]],
    [UserRole.SUPER_MASTER, [UserRole.MASTER, UserRole.DISTRIBUTOR, UserRole.SUB_DISTRIBUTOR, UserRole.STORE]],
    [UserRole.MASTER, [UserRole.DISTRIBUTOR]],
    [UserRole.DISTRIBUTOR, [UserRole.SUB_DISTRIBUTOR]],
    [UserRole.SUB_DISTRIBUTOR, [UserRole.STORE]],
    [UserRole.STORE, [UserRole.PLAYER]],
    [UserRole.PLAYER, []]
]);

async function seedRoles() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/dingding');

        // Clear existing roles
        await RoleModel.deleteMany({});

        // Create roles first to get their IDs
        const roleMap = new Map();

        for (const role of Object.values(UserRole)) {
            const newRole = await RoleModel.create({ name: role });
            roleMap.set(role, newRole._id);
        }

        // Update roles with their descendants
        for (const [role, descendants] of hierarchy.entries()) {
            const roleDoc = await RoleModel.findOne({ name: role });
            if (roleDoc) {
                roleDoc.descendants = descendants.map(d => roleMap.get(d));
                await roleDoc.save();
            }
        }

        console.log('Roles seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding roles:', error);
        process.exit(1);
    }
}

seedRoles();