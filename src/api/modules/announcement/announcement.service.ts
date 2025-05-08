import { Types } from "mongoose";
import createHttpError from "http-errors";
import { AnnouncementModel, IAnnouncement } from "./announcement.model";
import { scheduleAnnouncement } from "../../../common/lib/utils";

class AnnouncementService {
  async create(data: Partial<IAnnouncement>) {
    if (!data.content || !data.type || !data.target || !data.createdBy) {
      throw createHttpError(400, "Missing required announcement fields");
    }

    const announcement = await AnnouncementModel.create({
      content: data.content,
      type: data.type,
      target: data.target,
      targetUserIds: data.target === "user" ? data.targetUserIds ?? [] : [],
      createdBy: data.createdBy,
      scheduledAt: data.scheduledAt ?? null,
      deleted: false
    });

    if (announcement.scheduledAt && announcement.scheduledAt > new Date()) {
      scheduleAnnouncement(announcement);
    }

    return announcement;
  }

  async getAll(userId: Types.ObjectId) {
    const now = new Date();

    const query = {
      deleted: false,
      $and: [
        {
          $or: [
            { target: "all" },
            { target: "user", targetUserIds: userId }
          ]
        },
        {
          $or: [
            { scheduledAt: null },
            { scheduledAt: { $lte: now } }
          ]
        }
      ]
    };

    return await AnnouncementModel.find(query)
      .sort({ createdAt: -1 });
  }

  async markAsSeen(userId: Types.ObjectId, announcementId: Types.ObjectId) {
    const announcement = await AnnouncementModel.findById(announcementId);
    if (!announcement) {
      throw createHttpError(404, "Announcement not found");
    }

    const alreadySeen = announcement.seenBy.some(id => id.equals(userId));
    if (!alreadySeen) {
      announcement.seenBy.push(userId);
      await announcement.save();
    }

    return announcement;
  }
}

export default AnnouncementService;
