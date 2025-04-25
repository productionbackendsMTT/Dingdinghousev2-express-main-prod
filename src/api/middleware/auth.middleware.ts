import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../../common/config/config";

import { Document } from "mongoose";
import { IUser } from "../../common/types/user.type";
import { IRole } from "../../common/types/role.type";
import User from "../../common/schemas/user.schema";

export interface AuthRequest extends Request {
    requestingUser: (IUser & Document) & {
        role: IRole & Document;
    }
}

export const verifyToken = (token: string, secret: string) => {
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

        // Decode access token
        const decoded = await verifyToken(token, config.access.secret!);
        const requestingUserId = (decoded as any).userId;

        const requestingUser = await User.findById(requestingUserId).populate<{ role: IRole & Document }>('role');
        if (!requestingUser) {
            return next(createHttpError(401, 'Requesting user not found'));
        }

        // Check if the access token is blacklisted
        if (requestingUser.token && requestingUser.token.isBlacklisted) {
            return next(createHttpError(401, 'Access token is blacklisted'));
        }

        // Check refresh token for consistency
        const refreshToken = req.cookies.refreshToken;
        if (refreshToken) {
            try {
                const refreshDecoded = await verifyToken(refreshToken, config.refresh.secret!);
                const refreshUserId = (refreshDecoded as any).userId;

                if (requestingUserId !== refreshUserId || !requestingUser.token || requestingUser.token.refreshToken !== refreshToken || requestingUser.token.isBlacklisted) {
                    return next(createHttpError(401, 'Invalid token'));
                }

                // Check if the refresh token is expired
                if (requestingUser.token && new Date() > requestingUser.token.expiresAt) {
                    return next(createHttpError(401, 'Invalid token'));
                }
            } catch (refreshErr) {
                return next(createHttpError(401, 'Invalid token'));
            }
        }

        const _req = req as AuthRequest;
        _req.requestingUser = requestingUser;

        next();
    } catch (err) {
        console.log(err)
        if ((err as jwt.JsonWebTokenError).name === "TokenExpiredError") {
            return next(createHttpError(401, 'Authentication token has expired'));
        } else {
            return next(createHttpError(401, 'Invalid authentication token'));
        }
    }
};