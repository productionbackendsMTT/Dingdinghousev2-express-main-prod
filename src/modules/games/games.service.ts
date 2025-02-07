import createHttpError from "http-errors";
import GameModel, { GameStatus, IGame } from "./games.model";
import mongoose from "mongoose";
import { CloudinaryService } from "../../utils/cloudinary";
import { PayoutService } from "../payouts/payout.service";
import { create } from "domain";

export class GameService {
    private cloudinaryService: CloudinaryService;
    private payoutService: PayoutService;

    constructor() {
        this.cloudinaryService = new CloudinaryService();
        this.payoutService = new PayoutService();
    }

    private async getNextGameOrder(): Promise<number> {
        const lastGame = await GameModel.findOne().sort({ order: -1 }).select('order').lean<IGame>().exec();
        return lastGame ? lastGame.order + 1 : 1;
    }

    async createGame(gameData: { name: string, description: string, url: string, type: string, category: string, status: GameStatus, tag: string, slug: string }, thumbnailBuffer: Buffer, payout?: { content: any, filename: string }): Promise<IGame> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Check existing game
            const existingGame = await GameModel.findOne({
                $or: [{ name: gameData.name }, { tag: gameData.tag }],
                status: { $ne: GameStatus.DELETED }
            }).select('_id').lean().session(session);

            if (existingGame) {
                throw createHttpError.Conflict('Game name or tag already exists');
            }

            // 2. Create initial game without thumbnail
            const order = await this.getNextGameOrder();
            const game = await GameModel.create([{
                ...gameData,
                order
            }], { session });


            // 3. Create payout if provided
            const payoutId = payout ? await this.payoutService.createPayout(game[0]._id, payout, session) : null;

            // 4. Upload thumbnail
            const thumbnailUploadResult = await this.cloudinaryService.uploadImage(thumbnailBuffer);

            // 5. Update game with thumbnail and payout
            const updatedGame = await GameModel.findByIdAndUpdate(
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

    async getGames(filter: any, page: number = 1, limit: number = 10): Promise<{
        games: IGame[],
        meta: {
            total: number,
            page: number,
            limit: number,
            pages: number
        }
    }> {
        const [games, total] = await Promise.all([
            GameModel.find(filter)
                .sort({ order: 1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<IGame[]>()
                .exec(),
            GameModel.countDocuments(filter)
        ]);

        return {
            games: games,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
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

        const game = await GameModel
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
            const existingGame = await GameModel.findById(id)
                .populate('payout')
                .session(session);

            if (!existingGame) {
                throw createHttpError.NotFound('Game not found');
            }

            // 2. Check for duplicates if name or tag is being updated
            if (updateData.name || updateData.tag) {
                const duplicate = await GameModel.findOne({
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
            const updatedGame = await GameModel.findByIdAndUpdate(
                id,
                { $set: updateData },
                {
                    new: true,
                    runValidators: true,
                    session
                }
            ).populate('payout');

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

        const game = await GameModel.findById(id).select('status name tag').exec();

        if (!game) throw createHttpError.NotFound('Game not found');
        if (game.status === GameStatus.DELETED) {
            throw createHttpError.Conflict('Game already deleted');
        }

        // Update with deletion details
        const result = await GameModel.updateOne(
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

        const game = await GameModel.findById(gameId).lean();
        if (!game) throw createHttpError.NotFound('Game not found');

        return await this.payoutService.getPayoutByGame(gameId);
    }

    async activateGamePayout(gameId: string, payoutId: string): Promise<any> {
        if (!mongoose.Types.ObjectId.isValid(gameId) || !mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest('Invalid game or payout ID format');
        }

        const game = await GameModel.findById(gameId).lean();
        if (!game) throw createHttpError.NotFound('Game not found');

        return await this.payoutService.activatePayout(payoutId);
    }

    async deleteGamePayout(gameId: string, payoutId: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(gameId) || !mongoose.Types.ObjectId.isValid(payoutId)) {
            throw createHttpError.BadRequest('Invalid game or payout ID format');
        }

        const game = await GameModel.findById(gameId).lean();
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
            const existingGames = await GameModel.find({ _id: { $in: gameIds } })
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

            await GameModel.bulkWrite(bulkOps, { session });
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
                    const existingGame = await GameModel.findOne({ $or: [{ name: game.name }, { tag: game.tag }] }).session(session);
                    if (existingGame) {
                        result.skipped++;
                        result.errors.push(`Game ${game.name} already exists`);
                        continue;
                    }

                    const order = await this.getNextGameOrder();

                    // Create game without payout first
                    const createdGame = await GameModel.create([{
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
                        await GameModel.findByIdAndUpdate(
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
        const games = await GameModel.find({ status: { $ne: GameStatus.DELETED } }).populate('payout').sort({ order: 1, createdAt: -1 }).lean<IGame[]>().exec();
        return games;
    }
}