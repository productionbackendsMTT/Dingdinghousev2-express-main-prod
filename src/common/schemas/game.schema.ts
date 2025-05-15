import { model, Schema, Types } from "mongoose";
import { GameStatus, IGame } from "../types/game.type";

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
    payout: { type: Types.ObjectId, ref: "Payout", required: false }
}, { timestamps: true });

GameSchema.index({ status: 1 });
GameSchema.index({ order: 1 });

const Game = model<IGame>("Game", GameSchema);
export default Game;