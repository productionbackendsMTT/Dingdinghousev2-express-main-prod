import { model, Schema } from "mongoose";
import { IGameSession, ISession, ISpin } from "../types/session.type";

const SpinSchema = new Schema<ISpin>(
  {
    betAmount: { type: Number, required: true },
    winAmount: { type: Number, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { _id: true }
);

const GameSessionSchema = new Schema<IGameSession>(
  {
    gameId: { type: String, required: true },
    gameName: { type: String, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    initialCredit: { type: Number, required: true },
    finalCredit: { type: Number },
    duration: { type: Number },
    spins: { type: [SpinSchema], default: [] },
  },
  { _id: true }
);

const SessionSchema = new Schema<ISession>({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  path: { type: String, required: true },
  balanceOnEntry: { type: Number, required: true },
  balanceOnExit: { type: Number },
  connectedAt: { type: Date, required: true, default: Date.now },
  disconnectedAt: { type: Date },
  lastActivity: { type: Date, required: true, default: Date.now },
  gameSessions: { type: [GameSessionSchema], default: [] },
  isActive: { type: Boolean, required: true, default: true },
});

// Indexes
SessionSchema.index({ userId: 1 });
SessionSchema.index({ isActive: 1 });
SessionSchema.index({ lastActivity: 1 });
SessionSchema.index({ "gameSessions.gameId": 1 });

export const SessionModel = model<ISession>("Session", SessionSchema);
