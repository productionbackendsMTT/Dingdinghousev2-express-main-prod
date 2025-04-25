import { Socket } from "socket.io";
import jwt from 'jsonwebtoken';
import { config } from "../../common/config/config";

export interface PlaygroundSocketData {
    gameId: string;
    platform: string
}

export const playgroundAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Playground token required'));

    try {
        const decoded = jwt.verify(token, config.game.secret!) as PlaygroundSocketData;

        // Cast to playground-specific type
        (socket.data as PlaygroundSocketData) = {
            gameId: decoded.gameId,
            platform: decoded.platform,
        };
        next();
    } catch (error) {
        next(new Error('Invalid game token'));
    }
}