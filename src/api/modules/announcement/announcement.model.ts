import mongoose, { Schema, Document, Types } from "mongoose";

export type AnnouncementType = 'persistent' | 'ephemeral';
export type AnnouncementTarget = 'all' | 'user';

export interface IAnnouncement extends Document {
  _id: Types.ObjectId;
  content: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  targetUserIds?: Types.ObjectId[];
  createdBy: Types.ObjectId;
  deleted: boolean;
  scheduledAt?: Date;
  dispatchedAt?: Date;
  seenBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema: Schema<IAnnouncement> = new Schema({
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
    type: [Schema.Types.ObjectId],
    ref: 'User',
    default: []
  },
  createdBy: {
    type: Schema.Types.ObjectId,
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
  },
  seenBy: {
    type: [Schema.Types.ObjectId],
    ref: 'User',
    default: []
  }
}, { timestamps: true });

export const AnnouncementModel = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
