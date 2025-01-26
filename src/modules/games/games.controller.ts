import { Request, Response, NextFunction } from 'express';
import { GameService } from "./games.service";
import { GameStatus } from './games.model';

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
            const game = await this.gameService.createGame(req.body);
            res.status(201).json({
                success: true,
                data: game
            });
        } catch (error) {
            next(error);
        }
    }

    async getGames(req: Request, res: Response, next: NextFunction) {
        try {
            const status = req.query.status as GameStatus | undefined;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await this.gameService.getGames(status, page, limit);

            res.json({
                success: true,
                data: result.data,
                meta: result.meta
            });
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
            const game = await this.gameService.updateGame(req.params.id, req.body);
            res.json({
                success: true,
                data: game
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteGame(req: Request, res: Response, next: NextFunction) {
        try {
            await this.gameService.deleteGame(req.params.id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}