import { UserModel } from "../users";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from "../../config/config";
import createHttpError from "http-errors";
import { LoginResponse } from "../../types";
import TransactionService from "../transactions/transactions.service";
import mongoose from "mongoose";
import { TransactionType } from "../transactions/transactions.model";



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
            const newUser = new UserModel({ name, username, password: hashedPassword, balance, role, status, createdBy: parentId })
            await newUser.save({ session });


            // Create a transaction if balance is greater than 0
            if (balance > 0 && parentId) {
                await this.transactionService.create(parentId, newUser._id, TransactionType.RECHARGE, balance, session)
            }

            await session.commitTransaction();
            session.endSession();

            return {
                _id: newUser._id,
                username: newUser.username,
                role: newUser.role,
                balance: newUser.balance,
                status: newUser.status,
            };
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

    async refreshAccessToken(refreshToken: string): Promise<string> {
        const payload = jwt.verify(refreshToken, config.refresh.secret!) as any;
        const user = await UserModel.findById(payload.userId);

        if (!user || user.token?.refreshToken !== refreshToken) {
            throw createHttpError(403, 'Invalid refresh token')
        }

        return this.generateAccessToken(payload.userId);
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