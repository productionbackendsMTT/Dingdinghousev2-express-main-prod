import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import UserService from "./users.service";
import { successResponse } from "../../utils";

class UserController {
    constructor(private userService: UserService) {
        this.delete = this.delete.bind(this)
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params;

            if (!userId) {
                throw createHttpError(400, 'User ID is required');
            }

            await this.userService.delete(userId);

            res.status(200).json(successResponse({}, 'User deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

}

export default UserController;