import mongoose, { Model, Schema, Types } from "mongoose";
import { IRole, IRoleModel, RoleStatus } from "./roles.types";
import { config } from "../../config/config";

const PLAYER_ROLE = "player";

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
    if (this.isNew && this.name !== config.root.role) {
        const adminRole = await RoleModel.findOne({ name: config.root.role });
        if (adminRole) {
            adminRole.descendants.push(this._id);
            await adminRole.save();
        }
    }
    next()
})

RoleSchema.statics.ensureAdminRole = async function () {
    const adminRole = await this.findOne({ name: config.root.role });
    if (!adminRole) {
        return await this.create({
            name: config.root.role,
            descendants: [],
            status: RoleStatus.ACTIVE
        });
    }
    return adminRole;
};

RoleSchema.statics.ensurePlayerRole = async function () {
    const playerRole = await this.findOne({ name: PLAYER_ROLE });
    if (!playerRole) {
        return await this.create({
            name: PLAYER_ROLE,
            descendants: [],
            status: RoleStatus.ACTIVE
        })
    }
    return playerRole;
}

const RoleModel = mongoose.model<IRole, IRoleModel>("Role", RoleSchema);
export default RoleModel;