import express from 'express';
import { GameController } from './games.controller';
import { GameService } from './games.service';
import multer from 'multer';

const gamesRoutes = express.Router();
const gamesController = new GameController(new GameService());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });


gamesRoutes.post('/', upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'payout', maxCount: 1 }]), gamesController.createGame);
gamesRoutes.get('/', gamesController.getGames);
gamesRoutes.get('/:id', gamesController.getGameById);
gamesRoutes.put('/:id', gamesController.updateGame);
gamesRoutes.delete('/:id', gamesController.deleteGame);

export default gamesRoutes;