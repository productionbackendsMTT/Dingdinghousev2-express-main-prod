import { UserModel } from "../users";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from "../../config/config";
import createHttpError from "http-errors";
import { LoginResponse } from "../../types";



class AuthService {

    generateAccessToken(userId: string): string {
        return jwt.sign({ userId }, config.access.secret!, { expiresIn: config.access.expiresIn });
    }

    generateRefreshToken(userId: string): string {
        return jwt.sign({ userId }, config.refresh.secret!, { expiresIn: config.refresh.expiresIn });
    }

    async login(username: string, password: string, userAgent: string, ipAddress: string): Promise<LoginResponse> {
        const user = await UserModel.findOne({ username });
        if (!user || !user.password) {
            throw createHttpError(400, 'User not found')
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            throw createHttpError(400, 'Invalid credentials')
        }

        const accessToken = this.generateAccessToken(user._id.toString());
        const refreshToken = this.generateRefreshToken(user._id.toString());


        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7) // 7 Days from now

        user.token = {
            refreshToken,
            userAgent,
            ipAddress,
            expiresAt,
            isBlacklisted: false
        }

        await user.save()

        return {
            accessToken,
            refreshToken,
            user: {
                _id: user._id,
                username: user.username,
                role: user.role,
                balance: user.balance
            }
        };
    }

    async register(name: string, username: string, password: string, balance: number, role: string, status: string, parentId: string | null) {
        const existingUser = await UserModel.findOne({ username });
        if (existingUser) {
            throw createHttpError(409, 'Please choose a different username');
        }

        // hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // create a new user
        const newUser = new UserModel({ name, username, password: hashedPassword, balance, role, status, createdBy: parentId })
        await newUser.save();

        return {
            _id: newUser._id,
            username: newUser.username,
            role: newUser.role,
            balance: newUser.balance,
            status: newUser.status,
        };
    }

    async refreshAccessToken(refreshToken: string): Promise<string> {
        const payload = jwt.verify(refreshToken, config.refresh.secret!) as any;
        const user = await UserModel.findById(payload.userId);

        if (!user || user.token?.refreshToken !== refreshToken) {
            throw createHttpError(403, 'Invalid refresh token')
        }

        return this.generateAccessToken(payload.userId);
    }
}

export default AuthService