import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../config/config";
import UserModel, { IUser } from "../modules/users/users.model";
import { Document } from "mongoose";

export interface AuthRequest extends Request {
    requestingUser: IUser & Document; // Add this line to include the requesting user data
}

const verifyToken = (token: string, secret: string) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) {
                reject(err);
            } else {
                resolve(decoded);
            }
        });
    });
};

export const authHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return next(createHttpError(401, 'Invalid token format. Expected format: Bearer <token>'));
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return next(createHttpError(401, 'Authentication token not found'));
        }

        try {
            const decoded = await verifyToken(token, config.access.secret!);
            const requestingUserId = (decoded as any).userId;
            const requestingUser = await UserModel.findById(requestingUserId);

            if (!requestingUser) {
                return next(createHttpError(401, 'Requesting user not found'));
            }
            const _req = req as AuthRequest
            _req.requestingUser = requestingUser;

            next();
        } catch (err) {
            if ((err as jwt.JsonWebTokenError).name === "TokenExpiredError") {
                return next(createHttpError(401, 'Authentication token has expired'));
            } else {
                return next(createHttpError(401, 'Invalid authentication token'));
            }
        }
    } catch (error) {
        next(error);
    }
};