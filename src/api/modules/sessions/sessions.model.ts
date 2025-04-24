import mongoose, { Schema } from "mongoose";

export interface IPlatformSession extends Document {
    userId: mongoose.Types.ObjectId;
    startedAt: Date;
    endedAt: Date;
    isActive: boolean;
    initialBalance: number;
    finalBalance: number;
    gameSessions: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

export interface IGameSession extends Document {
    platformSessionId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    gameId: mongoose.Types.ObjectId;
    startedAt: Date;
    endedAt: Date;
    isActive: boolean;
    initialBalance: number;
    finalBalance: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISpin extends Document {
    gameSessionId: mongoose.Types.ObjectId;
    betAmount: number;
    winAmount: number;
    bonus?: {
        count: number;
        winAmount: number;
    };
    scatter?: {
        count: number;
        winAmount: number;
    };
    jackpot?: {
        count: number;
        winAmount: number;
    }
    createdAt: Date;
    updatedAt: Date;
}


const PlatformSessionSchema: Schema = new Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: true
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
    initialBalance: { type: Number, required: true },
    finalBalance: { type: Number, default: null },
    gameSessions: {
        type: [mongoose.Types.ObjectId],
        ref: "GameSession",
        default: []
    }
}, { timestamps: true });


const GameSessionSchema: Schema = new Schema({
    platformSessionId: {
        type: mongoose.Types.ObjectId,
        ref: "PlatformSession",
        required: true
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "User",
        required: true
    },
    gameId: {
        type: mongoose.Types.ObjectId,
        ref: "Game",
        required: true
    },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date, default: null },
    isActive: { type: Boolean, required: true, default: true },
    initialBalance: { type: Number, required: true },
    finalBalance: { type: Number, default: null }
}, { timestamps: true });


const SpinSchema: Schema = new Schema({
    gameSessionId: {
        type: mongoose.Types.ObjectId,
        ref: "GameSession",
        required: true
    },
    betAmount: { type: Number, required: true },
    winAmount: { type: Number, required: true },
    bonus: {
        count: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 }
    },
    scatter: {
        count: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 }
    },
    jackpot: {
        count: { type: Number, default: 0 },
        winAmount: { type: Number, default: 0 }
    }
}, { timestamps: true });


const PlatformSessionModel = mongoose.model<IPlatformSession>("PlatformSession", PlatformSessionSchema);
const GameSessionModel = mongoose.model<IGameSession>("GameSession", GameSessionSchema);
const SpinModel = mongoose.model<ISpin>("Spin", SpinSchema);

export { PlatformSessionModel, GameSessionModel, SpinModel };
