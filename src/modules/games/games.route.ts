import express from 'express';
import { GameController } from './games.controller';
import { GameService } from './games.service';

const gamesRouter = express.Router();
const gamesController = new GameController(new GameService());

gamesRouter.post('/', gamesController.createGame);
gamesRouter.get('/', gamesController.getGames);
gamesRouter.get('/:id', gamesController.getGameById);
gamesRouter.put('/:id', gamesController.updateGame);
gamesRouter.delete('/:id', gamesController.deleteGame);

export default gamesRouter;