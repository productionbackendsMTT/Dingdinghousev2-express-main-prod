import { Namespace, Socket } from "socket.io";
import { PlaygroundSocketData } from "../../middleware/playground.middleware";
import { PlaygroundService } from "./playground.service";

export function setupPlayground(namespace: Namespace) {
    const playgroundService = new PlaygroundService();

    namespace.on('connection', async (socket: Socket) => {
        try {
            const { gameId, platform } = socket.data as PlaygroundSocketData;

            // 1. Get game data with payout
            const game = await playgroundService.getGameWithPayout(gameId);

            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                socket.disconnect(true);
                return;
            }

            console.log(`New game connection | ID: ${socket.id}`);
            console.log('Game ID:', gameId);
            console.log('Platform:', platform);
            console.log('Game Details:', game.name);
            if (game.payout) {
                console.log('Payout Available:', game.payout.name);
            }

            // 2. Store game data in socket for later use
            socket.data.game = game;


            socket.on('disconnect', () => {
                console.log(`Player disconnected from game ${game.name}`);
            });
        } catch (error) {
            console.error('Connection error:', error);
            socket.emit('error', { message: 'Internal server error' });
            socket.disconnect(true);
        }
    });
}