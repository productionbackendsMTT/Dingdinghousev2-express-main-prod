import mongoose from "mongoose";
import { Socket } from "socket.io";

export interface JWTPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface ControlSocket extends Socket {
  data: {
    user: {
      _id: mongoose.Types.ObjectId;
      username: string;
      role: any; // Replace with proper role type from your schema
      permissions: any[]; // Replace with proper permissions type
      path: String;
    };
  };
}
