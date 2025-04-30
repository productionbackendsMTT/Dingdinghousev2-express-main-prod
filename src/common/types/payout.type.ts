import { Types } from "mongoose";

export interface IPayoutContent extends Record<string, any> {
  // No fixed fields, can contain any sturcture
}

export interface IPayout extends Document {
  gameId: Types.ObjectId; // Reference to the game
  name: string; // Name of the payout
  version: number; // Version number of the payout
  isActive: boolean; // Indicates if this payout is currently active
  content: IPayoutContent; // Dynamic content of the payout
  createdAt: Date; // Created date
  updatedAt: Date; // Updated date
}
