import createHttpError from "http-errors";
import GameModel, { GameStatus, IGame } from "./games.model";
import mongoose from "mongoose";

export class GameService {
    async createGame(gameData: IGame): Promise<IGame> {
        const existingGame = await GameModel.findOne({
            $or: [
                { name: gameData.name },
                { tag: gameData.tag }
            ]
        }).select('_id').lean();

        if (existingGame) {
            throw createHttpError.Conflict('Game name or tag already exists');
        }

        try {
            return await GameModel.create(gameData);
        } catch (error) {
            throw createHttpError.BadRequest(this.sanitizeMongoError(error));
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
        const filter = status ? { status } : {};
        const [games, total] = await Promise.all([
            GameModel.find(filter)
                .populate('payout')
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

        const game = await GameModel.findById(id).populate<{ payout: mongoose.Types.ObjectId }>('payout').lean<IGame>().exec();

        if (!game) throw createHttpError.NotFound('Game not found');
        return game;
    }

    async updateGame(id: string, gameData: Partial<IGame>): Promise<IGame> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw createHttpError.BadRequest('Invalid game ID format');
        }

        // Check for unique constraints
        if (gameData.name || gameData.tag) {
            const existingGame = await GameModel.findOne({
                $and: [
                    { _id: { $ne: id } },
                    {
                        $or: [
                            ...(gameData.name ? [{ name: gameData.name }] : []),
                            ...(gameData.tag ? [{ tag: gameData.tag }] : [])
                        ]
                    }
                ]
            }).select('_id').lean();

            if (existingGame) {
                throw createHttpError.Conflict('Game name or tag already exists');
            }
        }

        const updatedGame = await GameModel.findByIdAndUpdate(
            id,
            gameData,
            {
                new: true,
                runValidators: true
            }
        ).lean<IGame>().exec();

        if (!updatedGame) throw createHttpError.NotFound('Game not found');
        return updatedGame;
    }

    async deleteGame(id: string): Promise<void> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw createHttpError.BadRequest('Invalid game ID format');
        }

        const game = await GameModel.findById(id).select('status').exec();

        if (!game) throw createHttpError.NotFound('Game not found');
        if (game.status === GameStatus.DELETED) {
            throw createHttpError.Conflict('Game already deleted');
        }

        // Soft delete using status change
        const result = await GameModel.updateOne(
            { _id: id },
            { $set: { status: GameStatus.DELETED } }
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