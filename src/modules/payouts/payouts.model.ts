import mongoose, { Schema } from "mongoose";

export interface IPayout extends Document {
    gameId: mongoose.Types.ObjectId;
    content: {
        name: string;
        description: string;
        data: any;
        version: number;
        createdAt: Date;
        updatedAt: Date;
    }[];
    latestVersion: number;
    createdAt: Date;
    updatedAt: Date;
}

const PayoutSchema: Schema = new Schema({
    gameId: {
        type: mongoose.Types.ObjectId,
        ref: "Game",
        required: true
    },
    content: {
        type: [
            {
                name: { type: String, required: true },
                description: { type: String, required: true },
                version: { type: Number, required: true },
                data: { type: Schema.Types.Mixed, required: true },
                createdAt: { type: Date, default: Date.now },
                updatedAt: { type: Date, default: Date.now }
            }
        ],
        required: true
    },
    latestVersion: { type: Number, required: true },
}, { timestamps: true });

const PayoutModel = mongoose.model<IPayout>("Payout", PayoutSchema);
export default PayoutModel;