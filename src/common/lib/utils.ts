import { Request, Response } from "express";
import cron from "node-cron";
import { AnnouncementModel, IAnnouncement } from "../../api/modules/announcement/announcement.model";
import { roleHierarchy } from "./default-role-hierarchy";

const clients: Map<string, Response> = new Map();

// Register a user client for SSE
export function registerClient(userId: string, req: Request, res: Response) {
    clients.set(userId, res);

    req.on("close", () => {
        clients.delete(userId);
        console.log(`Connection closed for user: ${userId}`);
    });
}

// Send an announcement to connected clients
export function sendAnnouncementToClients(announcement: IAnnouncement) {
    const message = {
        id: announcement._id.toString(),
        content: announcement.content,
        type: announcement.type,
        createdAt: announcement.createdAt,
        dispatchedAt: new Date(),
    };

    if (announcement.target === "all") {
        for (const [, res] of clients) {
            sendSSE(res, message);
        }
    } else if (announcement.target === "user" && announcement.targetUserIds?.length) {
        for (const userId of announcement.targetUserIds) {
            const res = clients.get(userId.toString());
            if (res) {
                sendSSE(res, message);
            }
        }
    }
}

// Internal helper to send data via SSE
function sendSSE(res: Response, data: any) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Schedule an announcement using node-cron
export function scheduleAnnouncement(announcement: IAnnouncement) {
    if (!announcement.scheduledAt) return;

    const startTime = new Date(announcement.scheduledAt);

    const cronTime = `${startTime.getUTCMinutes()} ${startTime.getUTCHours()} ${startTime.getUTCDate()} ${startTime.getUTCMonth() + 1} *`;

    cron.schedule(
        cronTime,
        async () => {
            const fresh = await AnnouncementModel.findById(announcement._id);
            if (fresh) {
                sendAnnouncementToClients(fresh);
            }
        },
        {
            scheduled: true,
            timezone: "UTC",
        }
    );

    console.log(`Scheduled announcement: ${announcement._id} at ${announcement.scheduledAt}`);
}

// Get ancestor roles from default role hierarchy
export function getAncestorRoles(roleName: string): string[] {
    return Object.keys(roleHierarchy).filter((parentRole) =>
        roleHierarchy[parentRole].includes(roleName)
    );
}
