import createHttpError from "http-errors";
import UserModel from "./users.model";

class UserService {
    async delete(userId: string) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw createHttpError(404, 'User not found')
        }

        await user.deleteOne();
    }
}

export default UserService;