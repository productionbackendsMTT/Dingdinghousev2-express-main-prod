import { Request, Response, NextFunction } from "express";
import AuthService from "./auth.service";
import createHttpError from "http-errors";
import { successResponse } from "../../utils";
import { AuthRequest } from "../../middlewares";
import { LoginResponse } from "../../types";
import { config } from "../../config/config";
import { validateUserRole } from "../../utils/roleValidation.utils";
import { UserRole } from "../../config/hierarchy";


class AuthController {
    constructor(private authService: AuthService) {
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this.register = this.register.bind(this);
        this.refreshAccessToken = this.refreshAccessToken.bind(this);
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { username, password } = req.body;
            const userAgent = req.get('User-Agent')!;
            const ipAddress = req.ip!;

            if (!username || !password) {
                throw createHttpError(400, 'Username and password are required');
            }

            const { refreshToken, accessToken, user }: LoginResponse = await this.authService.login(username, password, userAgent, ipAddress);
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true, // Prevents JavaScript access
                secure: config.env === "production", // Only set cookies over HTTPS in production
                sameSite: "strict", // Can adjust baded on cross-origin requirements
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 day expiration (match token expiration)
            });

            // Send the access token in response body (for authorization in API requests)
            res.status(200).json(successResponse({ accessToken, user }, 'Login successful'));
        } catch (error) {
            next(error);
        }
    }

    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            const { name, username, password, balance, role, status } = req.body;

            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user ID not found');
            }


            if (!name || !username || !password || balance === undefined || !role || !status) {
                throw createHttpError(400, 'All required fields must be provided')
            }

            if (role === UserRole.ADMIN) {
                throw createHttpError(403, 'Registration of admin users is not allowed');
            }

            // Validare the role hierarchy
            validateUserRole(requestingUser.role, role)

            const newUser = await this.authService.register(name, username, password, balance, role, status, requestingUser._id);
            res.status(200).json(successResponse(newUser, 'User registered successfully'));
        } catch (error) {
            next(error)
        }
    }

    async refreshAccessToken(req: Request, res: Response, next: NextFunction) {
        try {
            const refreshToken = req.cookies.refreshToken; // Extract refresh token from the cookie
            if (!refreshToken) {
                throw createHttpError(401, 'Refresh token is missing or invalid');
            }

            const accessToken = await this.authService.refreshAccessToken(refreshToken);

            res.status(200).json(successResponse({ accessToken }, 'Access Token refreshed successfully'))

        } catch (error) {
            console.error("REFRESH TOKEN : ", error)
            next(error)
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const { requestingUser } = req as AuthRequest;
            if (!requestingUser) {
                throw createHttpError(400, 'Requesting user ID not found');
            }

            await this.authService.logout(requestingUser._id);
            res.clearCookie('refreshToken'); // Clear the refresh token cookie
            res.status(200).json(successResponse({}, 'Logged out successfully'));

        } catch (error) {
            next(error);
        }
    }


}

export default AuthController;