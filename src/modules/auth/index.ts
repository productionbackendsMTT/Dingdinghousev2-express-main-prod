import AuthController from "./auth.controller";
import authRoutes from "./auth.route";
import AuthService from "./auth.service";
import { IRegisterParams, IRegisterRequest, ILoginResponse } from "./auth.types"


export {
    AuthController,
    AuthService,
    IRegisterParams,
    IRegisterRequest,
    ILoginResponse,
    authRoutes
}