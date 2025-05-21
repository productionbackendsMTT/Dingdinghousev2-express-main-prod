import { SignOptions } from "jsonwebtoken";

export interface JWTConfig {
    secret: string;
    expiresIn: SignOptions["expiresIn"];
}


