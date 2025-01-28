import mongoose, { Schema } from "mongoose";

export enum GameStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended'
}

export interface IGame extends Document {
    name: string;
    description: string;
    thumbnail: string;
    url: string;
    type: string;
    category: string;
    status: GameStatus;
    tag: string;
    slug: string;
    order: number;

    payout: mongoose.Types.ObjectId; // Reference to the active payout
    createdAt: Date;
    updatedAt: Date;
}

const GameSchema: Schema = new Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    thumbnail: { type: String, required: false },
    url: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String },
    status: { type: String, enum: Object.values(GameStatus), default: GameStatus.ACTIVE },
    tag: { type: String, required: true, unique: true },
    slug: { type: String },
    order: { type: Number },
    payout: { type: mongoose.Types.ObjectId, ref: "Payout", required: false }
}, { timestamps: true });

GameSchema.index({ name: 1 }, { unique: true });
GameSchema.index({ tag: 1 }, { unique: true });
GameSchema.index({ status: 1 });
GameSchema.index({ order: 1 });

const GameModel = mongoose.model<IGame>("Game", GameSchema);
export default GameModel;