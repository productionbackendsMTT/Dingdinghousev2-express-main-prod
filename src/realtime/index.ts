import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { setupControl } from './gateways/control/control.gateway';
import { setupPlayground } from './gateways/playground/playground.gateway';
import { controlAuthMiddleware } from './middleware/control.middleware';
import { playgroundAuthMiddleware } from './middleware/playground.middleware';


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
    controlNamespace.use(controlAuthMiddleware);
    setupControl(controlNamespace);


    // Set up playground namespace
    const playgroundNamespace = io.of('/playground');
    playgroundNamespace.use(playgroundAuthMiddleware);
    setupPlayground(playgroundNamespace)

    console.log('Socket service initialized');

    return io;
}