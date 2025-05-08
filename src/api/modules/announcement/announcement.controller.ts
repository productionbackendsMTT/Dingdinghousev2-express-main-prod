import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Types } from "mongoose";
import AnnouncementService from "./announcement.service";
import { AuthRequest } from "../../middleware/auth.middleware";
import { successResponse } from "../../../common/lib/response";

class AnnouncementController {
    private service: AnnouncementService;

    constructor() {
        this.service = new AnnouncementService();
        this.create = this.create.bind(this);
        this.getAll = this.getAll.bind(this);
        this.markAsSeen = this.markAsSeen.bind(this);
    }

    private createSchema = z.object({
        title: z.string().min(1),
        message: z.string().min(1),
        type: z.enum(["persistent", "ephemeral"]),
        startTime: z.string().datetime().optional(), // ISO string
        endTime: z.string().datetime().optional(),
        targetUsers: z.array(z.string().refine(Types.ObjectId.isValid)).optional()
    });

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;

            const validation = this.createSchema.safeParse(req.body);
            if (!validation.success) {
                throw createHttpError(400, validation.error.errors[0].message);
            }

            const data = validation.data;
            const result = await this.service.create({
                ...data,
                createdBy: requestingUser._id
            });

            res.status(201).json(successResponse(result, "Announcement created successfully"));
        } catch (err) {
            next(err);
        }
    }

    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            const result = await this.service.getAll(requestingUser._id);
            res.status(200).json(successResponse(result, "Announcements fetched"));
        } catch (err) {
            next(err);
        }
    }

    async markAsSeen(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            const { id } = req.params;

            if (!Types.ObjectId.isValid(id)) {
                throw createHttpError(400, "Invalid announcement ID");
            }

            await this.service.markAsSeen(requestingUser._id, new Types.ObjectId(id));
            res.status(200).json(successResponse({}, "Marked as seen"));
        } catch (err) {
            next(err);
        }
    }
}

export default AnnouncementController;
