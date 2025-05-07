import mongoose, { Schema, Document, ObjectId } from "mongoose";

export type AnnouncementType = 'persistent' | 'ephemeral';
export type AnnouncementTarget = 'all' | 'user';

export interface IAnnouncement extends Document {
  content: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  targetUserIds?: mongoose.Types.ObjectId[];
  createdBy: ObjectId;
  deleted: boolean;
  scheduledAt?: Date;
  dispatchedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema: Schema = new Schema<IAnnouncement>({
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['persistent', 'ephemeral'],
    default: 'persistent'
  },
  target: {
    type: String,
    enum: ['all', 'user'],
    required: true
  },
  targetUserIds: {
    type: [mongoose.Types.ObjectId],
    ref: 'User',
    default: []
  },
  createdBy: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deleted: {
    type: Boolean,
    default: false
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  dispatchedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export const AnnouncementModel = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
