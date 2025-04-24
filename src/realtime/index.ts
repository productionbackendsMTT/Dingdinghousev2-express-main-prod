import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../common/config/config';
import { socketAuthMiddleware } from './middleware/auth.middleware';
import { setupControl } from './gateways/control/control.gateway';
import { setupPlayground } from './gateways/playground/playground.gateway';

export default function realtime(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ['GET', 'POST']
        }
    });

    // Apply global middleware

    // Set up control namespace with authentication
    const controlNamespace = io.of('/control');
    controlNamespace.use(socketAuthMiddleware);
    setupControl(controlNamespace);


    // Set up playground namespace
    const playgroundNamespace = io.of('/playground');
    playgroundNamespace.use(socketAuthMiddleware);
    setupPlayground(playgroundNamespace)

    console.log('Socket service initialized');

    return io;
}