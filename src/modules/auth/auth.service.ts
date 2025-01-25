import { UserModel } from "../users";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from "../../config/config";
import createHttpError from "http-errors";
import TransactionService from "../transactions/transactions.service";
import mongoose from "mongoose";
import { TransactionType } from "../transactions/transactions.model";
import { verifyToken } from "../../middlewares";
import { ILoginResponse, IRegisterParams } from "./auth.types";
import { IRole } from "../roles/roles.model";
import { UserStatus } from "../users/users.types";




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

    async login(username: string, password: string, userAgent: string, ipAddress: string): Promise<ILoginResponse> {
        const user = await UserModel.findOne({ username })
            .populate<{ role: IRole }>('role')
            .select('+password');

        if (!user) {
            throw createHttpError(404, 'User not found');
        }

        if (user.status !== UserStatus.ACTIVE) {
            throw createHttpError(403, 'Account is not active');
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

    async register(params: IRegisterParams) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const existingUser = await UserModel.findOne({ username: params.username }).session(session);
            if (existingUser) {
                throw createHttpError(409, 'Please choose a different username');
            }

            // hash the password
            const hashedPassword = await bcrypt.hash(params.password, 10);

            // create a new user
            const newUser = new UserModel({
                name: params.name,
                username: params.username,
                password: hashedPassword,
                balance: 0,
                role: params.roleId,
                status: params.status,
                createdBy: params.createdBy
            });
            await newUser.save({ session });


            // Create a transaction if balance is greater than 0
            if (params.balance > 0 && params.createdBy) {
                await this.transactionService.create(params.createdBy, newUser._id, TransactionType.RECHARGE, params.balance, session)
            }

            // Fetch the updated user data
            const updatedUser = await UserModel.findById(newUser._id)
                .populate('role')
                .session(session);

            await session.commitTransaction();
            return updatedUser;

        } catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
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

        if (user.token) {
            user.token.isBlacklisted = true; // Set isBlacklisted to true
        }
        await user.save();
    }
}

export default AuthService