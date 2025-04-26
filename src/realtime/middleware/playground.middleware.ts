import { Socket } from "socket.io";
import { ExtendedError } from 'socket.io/dist/namespace';
import jwt from 'jsonwebtoken';
import { config } from "../../common/config/config";
import { PlaygroundService } from "../gateways/playground/playground.service";


export const playgroundAuthMiddleware = async (socket: Socket, next: (err?: ExtendedError | undefined) => void) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Playground token required'));

    const service = new PlaygroundService();
    const tokenData = await service.validateToken(token);

    // If token not found in redis or invalid
    if (!tokenData) {
        return next(new Error('Invalid or expired game token'));
    }

    // Verify the platform token
    const platformToken = tokenData.platform;
    try {
        const decoded = jwt.verify(platformToken, config.access.secret!);

        // Cast to playground-specific type
        socket.data = {
            platform: decoded,
            gameId: tokenData.gameId
        };

        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        next(new Error('Invalid platform token'));
    }
}