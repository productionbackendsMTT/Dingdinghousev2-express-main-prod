import mongoose, { model, Schema, Types } from "mongoose";
import { UserRole } from "../../config/hierarchy";


export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended'
}

export interface IToken {
    refreshToken: string;
    userAgent: string;
    ipAddress: string;
    expiresAt: Date;
    isBlacklisted: boolean;
}

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    username: string;
    password: string;
    balance: number;
    role: UserRole;
    status: UserStatus;
    createdBy?: Types.ObjectId;
    totalSpent: number;
    totalReceived: number;
    lastLogin?: Date;
    favouriteGames?: string[];
    token?: IToken;
    path: String;
    createdAt: Date;
    updatedAt: Date;
    getDescendants(): Promise<IUser[]>;
}

const TokenSchema = new Schema<IToken>({
    refreshToken: { type: String, default: null },
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    isBlacklisted: { type: Boolean, default: false }
}, { _id: false })

const UserSchema = new Schema<IUser>({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: {
        type: String,
        enum: Object.values(UserRole),
        require: true,
    },
    status: {
        type: String,
        enum: Object.values(UserStatus),
        default: UserStatus.ACTIVE
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        default: null
    },
    totalSpent: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    lastLogin: { type: Date, default: null },
    favouriteGames: {
        type: [String],
        default: []
    },
    token: {
        type: TokenSchema,
        default: null
    },
    path: {
        type: String,
        required: true
    }
}, { timestamps: true });


// Middleware to set the materialized path before saving
UserSchema.pre('validate', async function (next) {
    if (this.isNew) {
        if (this.createdBy) {
            const parentUser = await UserModel.findById(this.createdBy);
            if (parentUser) {
                this.path = `${parentUser.path}/${this._id}`;
            } else {
                this.path = this._id.toString();
            }
        } else {
            this.path = this._id.toString();
        }
    }
    next();
});

// Middleware to check for child users before deleting
UserSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    const user = this as IUser & mongoose.Document;
    const childUsers = await UserModel.find({ createdBy: user._id });
    if (childUsers.length > 0) {
        return next(new Error('Cannot delete user with existing child users. Please delete the child users first.'));
    }
    next();
})

// Method to get all descendant users using materialized path
UserSchema.methods.getDescendants = async function (): Promise<IUser[]> {
    const descendants = await UserModel.find({ path: { $regex: `^${this.path}/` }, status: { $ne: UserStatus.DELETED } });
    return descendants;
}

const UserModel = model<IUser>("User", UserSchema);
export default UserModel;