import { Namespace, Socket } from "socket.io";

export function setupControl(namespace: Namespace) {
    namespace.on('connection', (socket: Socket) => {
        console.log(`Connected to control : ${socket.id}`);

        // Register event listeners

    });
}