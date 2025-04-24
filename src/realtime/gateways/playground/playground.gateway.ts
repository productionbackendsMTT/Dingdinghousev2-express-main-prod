import { Namespace, Socket } from "socket.io";

export function setupPlayground(namespace: Namespace) {
    namespace.on('connection', (socket: Socket) => {
        console.log(`Connected to playground : ${socket.id}`);

        // Register event listeners

    });
}