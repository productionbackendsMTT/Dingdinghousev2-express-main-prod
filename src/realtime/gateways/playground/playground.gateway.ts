import { Namespace } from "socket.io";
import { PlaygroundService } from "./playground.service";
import RedisService from "../../../common/config/redis";
import { PlaygroundSocket } from "./playground.types";


export function setupPlayground(namespace: Namespace) {
    const playgroundService = new PlaygroundService();
    const redisService = RedisService.getInstance();

    namespace.on('connection', async (socket: PlaygroundSocket) => {
        try {
            // Get user and game info from the socket data (set by middleware)
            const userId = socket.data.user.userId
            const gameId = socket.data.game.id;

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
