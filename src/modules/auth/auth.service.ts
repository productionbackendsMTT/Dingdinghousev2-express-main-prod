import { UserModel } from "../users";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from "../../config/config";
import createHttpError from "http-errors";
import { LoginResponse } from "../../types";
import TransactionService from "../transactions/transactions.service";
import mongoose from "mongoose";
import { TransactionType } from "../transactions/transactions.model";
import { verifyToken } from "../../middlewares";



class AuthService {
    private transactionService: TransactionService;

    constructor() {
        this.transactionService = new TransactionService();
    }

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

    async register(name: string, username: string, password: string, balance: number, role: string, status: string, parentId: mongoose.Types.ObjectId | null) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const existingUser = await UserModel.findOne({ username }).session(session);
            if (existingUser) {
                throw createHttpError(409, 'Please choose a different username');
            }

            // hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // create a new user
            const newUser = new UserModel({ name, username, password: hashedPassword, balance: 0, role, status, createdBy: parentId })
            await newUser.save({ session });


            // Create a transaction if balance is greater than 0
            if (balance > 0 && parentId) {
                await this.transactionService.create(parentId, newUser._id, TransactionType.RECHARGE, balance, session)
            }

            // Fetch the updated user data
            const updatedUser = await UserModel.findById(newUser._id).session(session);
            if (!updatedUser) {
                throw createHttpError(500, 'Failed to fetch updated user');
            }

            await session.commitTransaction();
            session.endSession();

            return {
                _id: updatedUser._id,
                username: updatedUser.username,
                role: updatedUser.role,
                balance: updatedUser.balance,
                status: updatedUser.status,
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

    async refreshAccessToken(refreshToken: string): Promise<string> {
        // Validate Refresh Token
        const decoded = await verifyToken(refreshToken, config.refresh.secret!);
        const userId = (decoded as any).userId;

        const user = await UserModel.findOne({ _id: userId, "token.refreshToken": refreshToken });
        if (!user) {
            throw createHttpError(401, 'Invalid refresh token')
        }

        const isTokenExpired = user.token!.expiresAt < new Date();
        if (user.token!.isBlacklisted || isTokenExpired) {
            throw createHttpError(401, 'Refresh token expired or blacklisted');
        }

        return this.generateAccessToken(user._id.toString());
    }

    async logout(userId: mongoose.Types.ObjectId): Promise<void> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        user.token = undefined; // Remove the token or set isBlacklisted to true
        await user.save();
    }
}

export default AuthService