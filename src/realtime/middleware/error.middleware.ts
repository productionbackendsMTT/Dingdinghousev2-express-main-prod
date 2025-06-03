import { Socket } from 'socket.io';

export const socketErrorMiddleware = (socket: Socket, next: (err?: Error) => void) => {
    // Custom error handling for socket connections
    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });

    next();
};