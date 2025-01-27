import mongoose, { Model, Schema, Types } from "mongoose";
import { ADMIN_ROLE_NAME, IRole, IRoleModel, RoleStatus } from "./roles.types";

const RoleSchema = new Schema<IRole, IRoleModel>({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    descendants: {
        type: [Types.ObjectId],
        ref: "Role",
        default: []
    },
    status: {
        type: String,
        enum: Object.values(RoleStatus),
        default: RoleStatus.ACTIVE
    }
}, { timestamps: true });

RoleSchema.pre('validate', async function (next) {
    if (this.isNew && this.name !== ADMIN_ROLE_NAME) {
        const adminRole = await RoleModel.findOne({ name: ADMIN_ROLE_NAME });
        if (adminRole) {
            adminRole.descendants.push(this._id);
            await adminRole.save();
        }
    }
    next()
})

RoleSchema.statics.ensureAdminRole = async function () {
    const adminRole = await this.findOne({ name: ADMIN_ROLE_NAME });
    if (!adminRole) {
        return await this.create({
            name: ADMIN_ROLE_NAME,
            descendants: [],
            status: RoleStatus.ACTIVE
        });
    }
    return adminRole;
};


const RoleModel = mongoose.model<IRole, IRoleModel>("Role", RoleSchema);
export default RoleModel;