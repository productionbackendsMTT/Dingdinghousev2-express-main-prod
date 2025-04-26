import { Socket } from "socket.io";

export interface PlatformPayload {
    userId: string;
}

export interface GameSessionData {
    user: PlatformPayload;
    game: {
        id: string;
    };
}

export interface PlaygroundSocket extends Socket {
    data: GameSessionData;
}