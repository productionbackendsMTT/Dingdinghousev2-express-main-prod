import { Socket } from "socket.io";
import jwt from 'jsonwebtoken';
import { config } from "../../common/config/config";

export const controlAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('Authentication error: Token required'));
    }

    try {
        const decoded = jwt.verify(token, config.access.secret);
        socket.data.user = decoded;
        next();
    } catch (error) {
        next(new Error('Authentication error: Invalid token'));
    }
}