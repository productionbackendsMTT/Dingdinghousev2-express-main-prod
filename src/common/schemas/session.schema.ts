import { model, Schema } from "mongoose";
import { IGameSession, ISession, ISpin } from "../types/session.type";

const SpinSchema = new Schema<ISpin>(
  {
    betAmount: { type: Number, required: true },
    winAmount: { type: Number, required: true },
    type: {
      type: String,
      required: true,
      enum: ["regular", "freespin"],
    },
    spunAt: { type: Date, required: true, default: Date.now },
    features: {
      type: {
        name: { type: String, required: true },
        count: { type: Number },
      },
      required: false,
    },
  },
  { _id: true }
);

const GameSessionSchema = new Schema<IGameSession>(
  {
    id: { type: String, required: true },
    gameId: { type: String, required: true },
    gameName: { type: String, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    duration: { type: Number },
    initialCredit: { type: Number, required: true },
    finalCredit: { type: Number },
    spins: { type: [SpinSchema], default: [] },
    totalBet: { type: Number },
    totalWin: { type: Number },
  },
  { _id: false }
);

const SessionSchema = new Schema<ISession>({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  path: { type: String, required: true },
  balanceOnEntry: { type: Number, required: true },
  currentBalance: { type: Number, required: true },
  balanceOnExit: { type: Number },
  connectedAt: { type: Date, required: true, default: Date.now },
  disconnectedAt: { type: Date },
  lastActivity: { type: Date, required: true, default: Date.now },
  completedGames: { type: [GameSessionSchema], default: [] },
  isActive: { type: Boolean, required: true },
});

// Indexes
SessionSchema.index({ userId: 1 });
SessionSchema.index({ isActive: 1 });
SessionSchema.index({ lastActivity: 1 });
SessionSchema.index({ "gameSessions.gameId": 1 });
SessionSchema.index({ "completedGames.spins.spunAt": 1 });

export const SessionModel = model<ISession>("Session", SessionSchema);
