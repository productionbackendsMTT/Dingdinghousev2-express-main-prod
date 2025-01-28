import createHttpError from "http-errors";
import GameModel, { GameStatus, IGame } from "./games.model";
import mongoose from "mongoose";
import PayoutModel from "../payouts/payouts.model";
import { CloudinaryService } from "../../utils/cloudinary";

export class GameService {
    private cloudinaryService: CloudinaryService;

    constructor() {
        this.cloudinaryService = new CloudinaryService();
    }

    private async getNextGameOrder(): Promise<number> {
        const lastGame = await GameModel.findOne().sort({ order: -1 }).select('order').lean<IGame>().exec();
        return lastGame ? lastGame.order + 1 : 1;
    }

    async createGameWithPayout(gameData: { name: string, description: string, url: string, type: string, category: string, status: GameStatus, tag: string, slug: string }, thumbnailBuffer: Buffer, payoutContent?: any): Promise<IGame> {
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
            let payoutId;
            if (payoutContent) {
                const payout = await PayoutModel.create([{
                    gameId: game[0]._id,
                    version: 1,
                    isActive: true,
                    content: payoutContent
                }], { session });
                payoutId = payout[0]._id;
            }

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

    async getGames(status?: GameStatus, page: number = 1, limit: number = 10): Promise<{
        data: IGame[],
        meta: {
            total: number,
            page: number,
            limit: number
        }
    }> {
        const baseFilter = { status: { $ne: GameStatus.DELETED } };
        const filter = status ? { ...baseFilter, status } : baseFilter;

        const [games, total] = await Promise.all([
            GameModel.find(filter)
                .sort({ order: 1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<IGame[]>()
                .exec(),
            GameModel.countDocuments(filter)
        ])

        return {
            data: games,
            meta: {
                total,
                page,
                limit
            }
        }
    }

    async getGameById(id: string): Promise<IGame> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw createHttpError.BadRequest('Invalid game ID format')
        }

        const game = await GameModel
            .findOne({
                _id: id,
                status: { $ne: GameStatus.DELETED }
            })
            .populate<{ payout: mongoose.Types.ObjectId }>('payout')
            .lean<IGame>()
            .exec();

        if (!game) throw createHttpError.NotFound('Game not found');
        return game;
    }

    async updateGame(id: string, updateData: Partial<IGame>, thumbnailBuffer?: Buffer, payoutContent?: any): Promise<IGame> {
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
            if (payoutContent) {
                const currentVersion = existingGame.payout ?
                    (await PayoutModel.findById(existingGame.payout).lean())?.version || 0 : 0;

                // Create new payout
                const newPayout = await PayoutModel.create([{
                    gameId: existingGame._id,
                    version: currentVersion + 1,
                    isActive: true,
                    content: payoutContent
                }], { session });

                // Deactivate old payouts
                await PayoutModel.updateMany(
                    {
                        gameId: existingGame._id,
                        _id: { $ne: newPayout[0]._id }
                    },
                    { isActive: false },
                    { session }
                );

                // Update game with new payout reference
                updateData.payout = newPayout[0]._id;
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
                    // Append random string to name/tag to free them up
                    name: `${game.name}_deleted_${Date.now()}`,
                    tag: `${game.tag}_deleted_${Date.now()}`
                }
            }
        ).exec();

        if (result.matchedCount === 0) {
            throw createHttpError.NotFound('Game not found');
        }
    }

    private sanitizeMongoError(error: any): string {
        if (error.name === 'ValidationError') {
            return Object.values(error.errors).map((err: any) => err.message).join(' ');
        }

        return error.message;
    }
}