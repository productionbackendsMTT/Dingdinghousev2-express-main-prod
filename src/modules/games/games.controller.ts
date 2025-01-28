import { Request, Response, NextFunction } from 'express';
import { GameService } from "./games.service";
import { GameStatus, IGame } from './games.model';
import createHttpError from 'http-errors';
import { successResponse } from '../../utils';
import mongoose from 'mongoose';


export class GameController {

    constructor(private readonly gameService: GameService) {
        this.createGame = this.createGame.bind(this);
        this.getGames = this.getGames.bind(this);
        this.getGameById = this.getGameById.bind(this);
        this.updateGame = this.updateGame.bind(this);
        this.deleteGame = this.deleteGame.bind(this);
    }

    async createGame(req: Request, res: Response, next: NextFunction) {
        try {
            // 1. Validate request body
            const { name, description, url, type, category, status, tag, slug } = req.body;
            if (!name || !url || !type || !category || !tag || !slug) {
                throw createHttpError.BadRequest('Missing required fields');
            }

            if (status && !Object.values(GameStatus).includes(status)) {
                throw createHttpError.BadRequest('Invalid status value');
            }

            // 2. Validate files
            if (!req.files || !(req.files as { [fieldname: string]: Express.Multer.File[] })['thumbnail']?.[0]) {
                throw createHttpError.BadRequest('Thumbnail is required');
            }

            const thumbnailBuffer = (req.files as { [fieldname: string]: Express.Multer.File[] })['thumbnail'][0].buffer;

            // 3. Parse payout if exists
            let payoutContent;
            if (req.files && (req.files as { [fieldname: string]: Express.Multer.File[] })['payout']?.[0]) {
                const payoutFile = (req.files as { [fieldname: string]: Express.Multer.File[] })['payout'][0];
                payoutContent = JSON.parse(payoutFile.buffer.toString());
            }

            // 4. Create game with service
            const game = await this.gameService.createGameWithPayout(
                {
                    name,
                    description,
                    url,
                    type,
                    category,
                    status: status || GameStatus.ACTIVE,
                    tag,
                    slug
                },
                thumbnailBuffer,
                payoutContent,

            );

            return res.status(201).json(successResponse(game, 'Game created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getGames(req: Request, res: Response, next: NextFunction) {
        try {
            const status = req.query.status as GameStatus | undefined;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            // Validate status if provided
            if (status && !Object.values(GameStatus).includes(status)) {
                throw createHttpError.BadRequest('Invalid status value');
            }

            const result = await this.gameService.getGames(status, page, limit);
            return res.status(200).json(successResponse(result.data, 'Games fetched successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }

    async getGameById(req: Request, res: Response, next: NextFunction) {
        try {
            const game = await this.gameService.getGameById(req.params.id);
            res.json({
                success: true,
                data: game
            });
        } catch (error) {
            next(error);
        }
    }

    async updateGame(req: Request, res: Response, next: NextFunction) {
        try {

            if (!req.params.id) {
                throw createHttpError.BadRequest('Game ID is required');
            }

            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                throw createHttpError.BadRequest('Invalid game ID');
            }
            const hasBodyUpdates = Object.keys(req.body).length > 0;
            const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

            const hasFileUpdates = files && (
                files['thumbnail']?.[0] ||
                files['payout']?.[0]
            );

            if (!hasBodyUpdates && !hasFileUpdates) {
                throw createHttpError.BadRequest('No updates provided - please provide either field updates or files to update');
            }

            // Build update object with only provided fields
            const updateData: Partial<IGame> = {};
            const allowedFields = ['name', 'description', 'url', 'type', 'category', 'status', 'tag', 'slug'] as const;
            type AllowedField = typeof allowedFields[number];

            allowedFields.forEach((field: AllowedField) => {
                const value = req.body[field];
                if (value !== undefined && value !== '') {
                    (updateData[field as keyof IGame] as any) = value;
                }
            });

            // Validate status if provided
            if (updateData.status && !Object.values(GameStatus).includes(updateData.status)) {
                throw createHttpError.BadRequest('Invalid status value');
            }


            let thumbnailBuffer: Buffer | undefined;
            if (files?.thumbnail?.[0]) {
                thumbnailBuffer = files.thumbnail[0].buffer;
            }

            let payoutContent: any;
            if (files?.payout?.[0]) {
                try {
                    payoutContent = JSON.parse(files.payout[0].buffer.toString());
                } catch (error) {
                    throw createHttpError.BadRequest('Invalid payout JSON format');
                }
            }

            const game = await this.gameService.updateGame(
                req.params.id,
                Object.keys(updateData).length > 0 ? updateData : {},
                thumbnailBuffer,
                payoutContent
            );
            return res.status(200).json(
                successResponse(game, 'Game updated successfully')
            );
        } catch (error) {
            next(error);
        }
    }

    async deleteGame(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.params.id) {
                throw createHttpError.BadRequest('Game ID is required');
            }

            await this.gameService.deleteGame(req.params.id);
            res.status(200).json(successResponse(null, 'Game deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}