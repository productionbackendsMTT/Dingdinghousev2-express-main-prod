import mongoose, { Model, Schema, Types } from "mongoose";

export const ADMIN_ROLE_ID = new Types.ObjectId("000000000000000000000001");
export const ADMIN_ROLE_NAME = "admin";

export enum RoleStatus {
    ACTIVE = 'active',
    DELETED = 'deleted'
}

export interface IRole extends Document {
    _id: Types.ObjectId;
    name: string;
    descendants: Types.ObjectId[];
    status: RoleStatus;
}

interface IRoleModel extends Model<IRole> {
    ensureAdminRole(): Promise<void>;
}

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

RoleSchema.statics.ensureAdminRole = async function () {
    const adminRole = await this.findOne({ name: ADMIN_ROLE_NAME });
    if (!adminRole) {
        await this.create({
            _id: ADMIN_ROLE_ID,
            name: ADMIN_ROLE_NAME,
            descendants: []
        });
    }
};


const RoleModel = mongoose.model<IRole, IRoleModel>("Role", RoleSchema);

RoleModel.ensureAdminRole().catch(console.error);

export default RoleModel;