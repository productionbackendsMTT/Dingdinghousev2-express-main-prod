import createHttpError from "http-errors";
import mongoose, { Types } from "mongoose";
import { CloudinaryService } from "../../../common/config/cloudinary";
import { PayoutService } from "../payouts/payout.service";
import Game from "../../../common/schemas/game.schema";
import { GameStatus, IGame } from "../../../common/types/game.type";
import jwt from 'jsonwebtoken';
import { config } from "../../../common/config/config";

export class GameService {
    private cloudinaryService: CloudinaryService;
    private payoutService: PayoutService;

    constructor() {
        this.cloudinaryService = new CloudinaryService();
        this.payoutService = new PayoutService();
    }

    private async getNextGameOrder(): Promise<number> {
        const lastGame = await Game.findOne().sort({ order: -1 }).select('order').lean<IGame>().exec();
        return lastGame ? lastGame.order + 1 : 1;
    }

    async createGame(gameData: { name: string, description: string, url: string, type: string, category: string, status: GameStatus, tag: string, slug: string, order: number }, thumbnailBuffer: Buffer, payout?: { content: any, filename: string }): Promise<IGame> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Check existing game
            const existingGame = await Game.findOne({
                $or: [{ name: gameData.name }, { tag: gameData.tag }],
                status: { $ne: GameStatus.DELETED }
            }).select('_id').lean().session(session);

            if (existingGame) {
                throw createHttpError.Conflict('Game name or tag already exists');
            }

            // 2. Create initial game without thumbnail
            const game = await Game.create([{
                ...gameData,
            }], { session });


            // 3. Create payout if provided
            const payoutId = payout ? await this.payoutService.createPayout(game[0]._id, payout, session) : null;

            // 4. Upload thumbnail
            const thumbnailUploadResult = await this.cloudinaryService.uploadImage(thumbnailBuffer);

            // 5. Update game with thumbnail and payout
            const updatedGame = await Game.findByIdAndUpdate(
                game[0]._id,
                {
                    thumbnail: thumbnailUploadResult.secure_url,
                    ...(payoutId && { payout: payoutId })
                },
                { session, returnDocument: 'after' }
            );
            if (!updatedGame) {
                throw createHttpError.NotFound('Game not found');
            }

            await session.commitTransaction();
            return updatedGame;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async getGames(filters: any, options: { page: number; limit: number; sort: any }): Promise<{
        data: IGame[],
        meta: {
            total: number; page: number; limit: number; pages: number; filters: {
                categories: string[];
                types: string[];
            }
        }
    }> {
        const { search, from, to, status, type, category, tag, ...otherFilters } = filters;
        const query: any = {
            status: { $ne: GameStatus.DELETED },
            ...otherFilters
        };

        // Add date range filtering
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }

        // Add status filter
        if (status) {
            query.status = status;
        }

        // Add search functionality
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { type: searchRegex },
                { category: searchRegex },
                { tag: searchRegex }
            ];
        }

        // Add specific filters
        if (type) query.type = type;
        if (category) query.category = category;
        if (tag) query.tag = tag;


        const [games, total, distinctValues] = await Promise.all([
            Game.find(query)
                .sort(options.sort)
                .skip((options.page - 1) * options.limit)
                .limit(options.limit)
                .lean<IGame[]>(),
            Game.countDocuments(query),
            Promise.all([
                Game.distinct('category', { status: { $ne: GameStatus.DELETED } }),
                Game.distinct('type', { status: { $ne: GameStatus.DELETED } }),
            ])
        ]);

        const [categories, types] = distinctValues;


        return {
            data: games,
            meta: {
                total,
                page: options.page,
                limit: options.limit,
                pages: Math.ceil(total / options.limit),
                filters: {
                    categories,
                    types,
                }
            }
        };
    }

    async getGame({ id, tag, slug, name }: { id?: string; tag?: string; slug?: string; name?: string }): Promise<IGame> {
        const filter: any = { status: { $ne: GameStatus.DELETED } };

        if (id) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw createHttpError.BadRequest("Invalid game ID format");
            }
            filter._id = id;
        } else if (tag) {
            filter.tag = tag;
        } else if (slug) {
            filter.slug = slug;
        } else if (name) {
            filter.name = { $regex: new RegExp(`^${name}$`, "i") }; // Case-insensitive exact match
        } else {
            throw createHttpError.BadRequest("At least one identifier (id, tag, slug, name) is required");
        }

        const game = await Game
            .findOne(filter)
            .populate<{ payout: mongoose.Types.ObjectId }>("payout")
            .lean<IGame>()
            .exec();

        if (!game) throw createHttpError.NotFound("Game not found");
        return game;
    }

    async updateGame(id: string, updateData: Partial<IGame>, thumbnailBuffer?: Buffer, payout?: { content: any, filename: string }): Promise<IGame> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. First check if game exists
            const existingGame = await Game.findById(id)
                .populate('payout')
                .session(session);

            if (!existingGame) {
                throw createHttpError.NotFound('Game not found');
            }

            // 2. Check for duplicates if name or tag is being updated
            if (updateData.name || updateData.tag) {
                const duplicate = await Game.findOne({
                    _id: { $ne: id },
                    $or: [
                        ...(updateData.name ? [{ name: updateData.name }] : []),
                        ...(updateData.tag ? [{ tag: updateData.tag }] : [])
                    ]
                }).session(session);

                if (duplicate) {
                    throw createHttpError.Conflict('Game name or tag already exists');
                }
            }

            // 3. Handle payout update if provided
            if (payout && payout.content && payout.filename) {
                const newPayoutId = await this.payoutService.createPayout(existingGame._id, payout, session);
                if (newPayoutId) {
                    updateData.payout = newPayoutId;
                }
            }

            // 4. Handle thumbnail if provided
            if (thumbnailBuffer) {
                const uploadResult = await this.cloudinaryService.uploadImage(thumbnailBuffer);
                updateData.thumbnail = uploadResult.secure_url;
            }

            // 5. Update game with all changes
            const updatedGame = await Game.findByIdAndUpdate(
                id,
                { $set: updateData },
                {
                    new: true,
                    runValidators: true,
                    session
                }
            );

            if (!updatedGame) {
                throw createHttpError.NotFound('Game not found');
            }

            await session.commitTransaction();
            return updatedGame;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async deleteGame(id: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw createHttpError.BadRequest('Invalid game ID format');
        }

        const game = await Game.findById(id).select('status name tag').exec();

        if (!game) throw createHttpError.NotFound('Game not found');
        if (game.status === GameStatus.DELETED) {
            throw createHttpError.Conflict('Game already deleted');
        }

        // Update with deletion details
        const result = await Game.updateOne(
            { _id: id },
            {
                $set: {
                    status: GameStatus.DELETED,
                    deletedAt: new Date(),
                    name: `${game.name}_deleted_${Date.now()}`,
                    tag: `${game.tag}_deleted_${Date.now()}`
                }
            }
        ).exec();

        if (result.matchedCount === 0) {
            throw createHttpError.NotFound('Game not found');
        }
    }

    async getGamePayouts(gameId: string): Promise<any> {
        if (!mongoose.Types.ObjectId.isValid(gameId)) {
            throw createHttpError.BadRequest('Invalid game ID format');
        }

        const game = await Game.findById(gameId).lean();
        if (!game) throw createHttpError.NotFound('Game not found');

        return await this.payoutService.getPayoutByGame(gameId);
    }

    async activateGamePayout(gameId: string, payoutId: string): Promise<any> {
        if (!mongoose.Types.ObjectId.isValid(gameId) || !mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest('Invalid game or payout ID format');
        }

        const game = await Game.findById(gameId).lean();
        if (!game) throw createHttpError.NotFound('Game not found');

        return await this.payoutService.activatePayout(payoutId);
    }

    async deleteGamePayout(gameId: string, payoutId: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(gameId) || !mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest('Invalid game or payout ID format');
        }

        const game = await Game.findById(gameId).lean();
        if (!game) throw createHttpError.NotFound('Game not found');

        return await this.payoutService.deletePayout(payoutId);
    }

    async reorderGames(reorderData: { gameId: string; order: number }[]): Promise<void> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate all IDs first
            const invalidIds = reorderData.filter(({ gameId }) => !mongoose.Types.ObjectId.isValid(gameId));
            if (invalidIds.length > 0) {
                throw createHttpError.BadRequest(`Invalid game IDs: ${invalidIds.map(i => i.gameId).join(', ')}`);
            }

            // Verify all games exist
            const gameIds = reorderData.map(item => item.gameId);
            const existingGames = await Game.find({ _id: { $in: gameIds } })
                .select('_id')
                .session(session);

            if (existingGames.length !== gameIds.length) {
                const missingIds = gameIds.filter(id =>
                    !existingGames.find(game => game._id.toString() === id)
                );
                throw createHttpError.NotFound(`Games not found: ${missingIds.join(', ')}`);
            }

            // Perform bulk update
            const bulkOps = reorderData.map(({ gameId, order }) => ({
                updateOne: {
                    filter: { _id: gameId },
                    update: { $set: { order } }
                }
            }));

            await Game.bulkWrite(bulkOps, { session });
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async uploadGames(games: IGame[]): Promise<{ total: number; created: number, skipped: number, errors: string[] }> {
        const session = await mongoose.startSession();
        session.startTransaction();

        const result = {
            total: games.length,
            created: 0,
            skipped: 0,
            errors: [] as string[]
        }

        try {
            for (const game of games) {
                try {
                    const existingGame = await Game.findOne({ $or: [{ name: game.name }, { tag: game.tag }] }).session(session);
                    if (existingGame) {
                        result.skipped++;
                        result.errors.push(`Game ${game.name} already exists`);
                        continue;
                    }

                    const order = await this.getNextGameOrder();

                    // Create game without payout first
                    const createdGame = await Game.create([{
                        name: game.name,
                        description: game.description,
                        url: game.url,
                        type: game.type,
                        category: game.category,
                        status: game.status || GameStatus.ACTIVE,
                        tag: game.tag,
                        slug: game.slug,
                        thumbnail: game.thumbnail,
                        order,
                    }], { session });

                    // Handle payout if exists
                    if (game.payout) {
                        const payoutId = await this.payoutService.createPayout(
                            createdGame[0]._id,
                            {
                                content: (game.payout as any).content,
                                filename: (game.payout as any).name
                            },
                            session
                        );

                        // Update game with payout reference
                        await Game.findByIdAndUpdate(
                            createdGame[0]._id,
                            { payout: payoutId },
                            { session }
                        );
                    }


                    result.created++;
                } catch (error) {
                    if (error instanceof Error) {
                        result.errors.push(`Failed to import ${game.name}: ${error.message}`);
                    } else {
                        result.errors.push(`Failed to import ${game.name}: Unknown error`);
                    }
                    result.skipped++;
                }
            }

            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    async downloadGames(): Promise<IGame[]> {
        const games = await Game.find({ status: { $ne: GameStatus.DELETED } }).populate('payout').sort({ order: 1, createdAt: -1 }).lean<IGame[]>().exec();
        return games;
    }

    async playGame(token: string, slug: string): Promise<string> {
        try {
            const filter: any = {
                slug: slug,
                status: { $ne: GameStatus.DELETED }
            };
            const game = await Game
                .findOne(filter)
                .select('url')
                .lean<IGame>()
                .exec();

            if (!game) {
                throw new Error('Game not found');
            }

            const gameToken = await this.generateGameToken(game._id, token);

            // Create a signed URL by appending the token
            const signedUrl = `${game.url}?token=${gameToken}`;
            return signedUrl;
        } catch (error) {
            throw error;
        }
    }

    async generateGameToken(gameId: Types.ObjectId, platformToken: string) {
        return jwt.sign(
            {
                id: gameId,          // Include game ID in the token
                platform: platformToken  // Include platform token
            },
            config.game.secret!,         // Use a strong secret key
            { expiresIn: config.game.expiresIn }         // Token expires in 1 hour (adjust as needed)
        );
    }
}