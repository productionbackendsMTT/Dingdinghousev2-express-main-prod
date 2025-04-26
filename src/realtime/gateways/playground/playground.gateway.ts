import { Namespace, Socket } from "socket.io";
import { PlaygroundService } from "./playground.service";
import RedisService from "../../../common/config/redis";

export function setupPlayground(namespace: Namespace) {
    const playgroundService = new PlaygroundService();
    const redisService = RedisService.getInstance();

    namespace.on('connection', async (socket: Socket) => {
        try {
            // Get user and game info from the socket data (set by middleware)
            const userId = socket.data.platform.userId;
            const gameId = socket.data.gameId;

            // 1. Get game data with payout
            const game = await playgroundService.getGameWithPayout(gameId);

            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                socket.disconnect(true);
                return;
            }

            console.log(`New game connection | ID: ${socket.id}`);
            console.log('Game ID:', gameId);
            console.log('Platform:', userId);
            console.log('Game Details:', game.name);
            if (game.payout) {
                console.log('Payout Available:', game.payout.name);
            }

            // 2. Store game data in socket for later use
            socket.data.game = game;

            // ✅ 3. Send payout info immediately to client
            if (game.payout) {
                socket.emit('payoutInfo', {
                    payoutName: game.payout.name,
                    payoutDetails: game.payout // send full payout object if needed
                });
            } else {
                socket.emit('payoutInfo', {
                    payoutName: null,
                    message: 'No payout available for this game.'
                });
            }

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
