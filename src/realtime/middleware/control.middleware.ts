import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../../common/config/config";
import User from "../../common/schemas/user.schema";
import mongoose from "mongoose";
import { UserStatus } from "../../common/types/user.type";
import { ControlSocket, JWTPayload } from "../gateways/control/control.types";

export const controlAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error: Token required"));
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, config.access.secret) as JWTPayload;

    if (!decoded.userId) {
      return next(new Error("Authentication error: Invalid token payload"));
    }

    // Validate user exits and is active
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(decoded.userId),
      status: UserStatus.ACTIVE,
    })
      .select("_id username role permissions path")
      .populate("role", "name");

    if (!user) {
      return next(
        new Error("Authentication error: User not found or inactive")
      );
    }

    // Type assertion for authenticated socket
    const authSocket = socket as ControlSocket;

    // Add validated user data to socket
    authSocket.data.user = {
      _id: user._id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      path: user.path,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error("Authentication error: Invalid token"));
    }
    console.error("Socket authentication error:", error);
    next(new Error("Internal server error"));
  }
};
