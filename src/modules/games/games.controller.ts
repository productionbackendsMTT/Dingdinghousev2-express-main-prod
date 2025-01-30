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
        this.updateGame = this.updateGame.bind(this);
        this.deleteGame = this.deleteGame.bind(this);
        this.getGamePayouts = this.getGamePayouts.bind(this);
        this.activateGamePayout = this.activateGamePayout.bind(this);
        this.deleteGamePayout = this.deleteGamePayout.bind(this);
        this.getGame = this.getGame.bind(this);
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
            let payoutFilename;

            if (req.files && (req.files as { [fieldname: string]: Express.Multer.File[] })['payout']?.[0]) {
                const payoutFile = (req.files as { [fieldname: string]: Express.Multer.File[] })['payout'][0];
                payoutContent = JSON.parse(payoutFile.buffer.toString());
                payoutFilename = payoutFile.originalname;
            }

            // 4. Create game with service
            const game = await this.gameService.createGame(
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
                {
                    content: payoutContent,
                    filename: payoutFilename || ''
                },

            );

            return res.status(201).json(successResponse(game, 'Game created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getGames(req: Request, res: Response, next: NextFunction) {
        try {
            const { status, page = "1", limit = "10", ...filters } = req.query;
            const parsedPage = parseInt(page as string, 10) || 1;
            const parsedLimit = parseInt(limit as string, 10) || 10;

            // Validate status if provided
            if (status && !Object.values(GameStatus).includes(status as GameStatus)) {
                throw createHttpError.BadRequest("Invalid status value");
            }
            // Construct search filters dynamically
            const filterQuery: any = { status: { $ne: GameStatus.DELETED } };

            if (status) {
                filterQuery.status = status;
            }

            Object.keys(filters).forEach((key) => {
                if (filters[key]) {
                    filterQuery[key] = { $regex: filters[key], $options: "i" }; // Case-insensitive search
                }
            });

            const result = await this.gameService.getGames(filterQuery, parsedPage, parsedLimit);
            return res.status(200).json(successResponse(result.data, 'Games fetched successfully', result.meta));
        } catch (error) {
            next(error);
        }
    }

    async getGame(req: Request, res: Response, next: NextFunction) {
        try {
            const { id, tag, slug, name } = req.params;
            const game = await this.gameService.getGame({ id, tag, slug, name });

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
            let payoutFilename: string = '';

            if (files?.payout?.[0]) {
                try {
                    payoutFilename = files.payout[0].originalname;
                    payoutContent = JSON.parse(files.payout[0].buffer.toString());
                } catch (error) {
                    throw createHttpError.BadRequest('Invalid payout JSON format');
                }
            }

            const game = await this.gameService.updateGame(
                req.params.id,
                Object.keys(updateData).length > 0 ? updateData : {},
                thumbnailBuffer,
                {
                    content: payoutContent,
                    filename: payoutFilename || ''
                }
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

    async getGamePayouts(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const payouts = await this.gameService.getGamePayouts(id);
            res.status(200).json(successResponse(payouts, 'Payouts fetched successfully'));
        } catch (error) {
            next(error);
        }
    }

    async activateGamePayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { id, payoutId } = req.params;

            if (!id || !payoutId) {
                throw createHttpError.BadRequest('Game ID and Payout ID are required');
            }

            const payout = await this.gameService.activateGamePayout(id, payoutId);
            res.status(200).json(successResponse(payout, 'Payout activated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteGamePayout(req: Request, res: Response, next: NextFunction) {
        try {
            const { id, payoutId } = req.params;

            if (!id || !payoutId) {
                throw createHttpError.BadRequest('Game ID and Payout ID are required');
            }



        } catch (error) {
            next(error);
        }
    }
}