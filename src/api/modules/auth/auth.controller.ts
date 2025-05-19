import { Request, Response, NextFunction } from "express";
import AuthService from "./auth.service";
import createHttpError from "http-errors";
import { ILoginResponse } from "./auth.types";
import RoleService from "../roles/roles.service";
import { z } from "zod";
import { Types } from "mongoose";
import { successResponse } from "../../../common/lib/response";
import { config } from "../../../common/config/config";
import { AuthRequest } from "../../middleware/auth.middleware";
import { UserStatus } from "../../../common/types/user.type";

class AuthController {
  private roleService: RoleService;

  private registerSchema = z.object({
    name: z
      .string({ required_error: "Name is required" })
      .min(2, "Name must be at least 2 characters long")
      .max(100, "Name is too long"),
    username: z
      .string({ required_error: "Username is required" })
      .min(3, "Username must be at least 3 characters long")
      .max(30, "Username is too long"),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password must be at least 6 characters long"),
    roleId: z
      .string({ required_error: "Role ID is required" })
      .refine((val) => Types.ObjectId.isValid(val), {
        message: "Invalid role ID format",
      }),
    balance: z.number().default(0),
    status: z.nativeEnum(UserStatus, {
      required_error: "Status is required",
      invalid_type_error: "Status must be a valid user status",
    }),
  });

  constructor(private authService: AuthService) {
    this.roleService = new RoleService();
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.register = this.register.bind(this);
    this.refreshAccessToken = this.refreshAccessToken.bind(this);
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const userAgent = req.get("User-Agent")!;
      const ipAddress = req.ip!;

      if (!username || !password) {
        throw createHttpError(400, "Username and password are required");
      }

      const { refreshToken, accessToken, user }: ILoginResponse =
        await this.authService.login(username, password, userAgent, ipAddress);
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: config.env === "production",
        sameSite: config.env === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
        domain: config.domain,
      });

      // Send the access token in response body (for authorization in API requests)
      res
        .status(200)
        .json(successResponse({ accessToken, user }, "Login successful"));
    } catch (error) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestingUser } = req as AuthRequest;

      const validationResult = this.registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = validationResult.error.errors[0].message;
        throw createHttpError(400, errorMessage);
      }

      const { name, username, password, roleId, status, balance } =
        validationResult.data;

      if (!requestingUser) {
        throw createHttpError(400, "Requesting user ID not found");
      }

      // Validate role exits
      const targetRole = await this.roleService.getRole(
        new Types.ObjectId(roleId)
      );
      if (!targetRole) {
        throw createHttpError(404, "Role not found");
      }

      // Validare the role hierarchy
      await this.roleService.validateRole(
        requestingUser.role._id,
        new Types.ObjectId(roleId)
      );

      const newUser = await this.authService.register({
        name,
        username,
        password,
        roleId: new Types.ObjectId(roleId),
        status,
        balance, // ✅ Optional value is passed only if present
        createdBy: requestingUser._id,
      });
      res
        .status(200)
        .json(successResponse(newUser, "User registered successfully"));
    } catch (error) {
      next(error);
    }
  }

  async refreshAccessToken(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies.refreshToken; // Extract refresh token from the cookie
      if (!refreshToken) {
        return next(createHttpError(401, "Refresh token not provided"));
      }
      const accessToken = await this.authService.refreshAccessToken(
        refreshToken
      );

      res
        .status(200)
        .json(
          successResponse(
            { accessToken },
            "Access Token refreshed successfully"
          )
        );
    } catch (error) {
      console.error("REFRESH TOKEN : ", error);
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { requestingUser } = req as AuthRequest;
      if (!requestingUser) {
        throw createHttpError(400, "Requesting user ID not found");
      }

      await this.authService.logout(requestingUser._id);
      res.clearCookie("refreshToken"); // Clear the refresh token cookie
      res.status(200).json(successResponse({}, "Logged out successfully"));
    } catch (error) {
      next(error);
    }
  }

  async sendEvents(req: Request, res: Response) {
    try {
      res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": config.clientUrl, // Add this
        "Access-Control-Allow-Credentials": "true", // If using credentials,
      });

      res.flushHeaders();

      // Send initial connection message
      res.write("event: connected\n");

      const sendPing = () => {
        res.write(
          `event: ping\ndata: ${JSON.stringify({
            time: new Date().toISOString(),
          })}\n\n`
        );
      };

      res.write(`data: ${JSON.stringify({ message: "SSE connected" })}\n\n`);

      const intervalId = setInterval(sendPing, 1000);

      req.on("close", () => {
        clearInterval(intervalId);
        res.end();
      });
    } catch (err) {
      console.error("Error in sendEvents:", err);
      res.status(500).end();
    }
  }
}

export default AuthController;
