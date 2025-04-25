import { Roles } from "../lib/default-role-hierarchy";
import { JWTConfig } from "./jwt.type";

export interface AppConfig {
    port: number;
    env: string;
    db: string;
    access: JWTConfig;
    refresh: JWTConfig;
    game: JWTConfig;
    cloudinary: {
        cloud_name?: string;
        api_key?: string;
        api_secret?: string;
    };
    root: {
        role: Roles.ROOT;
        name?: string;
        username?: string;
        password?: string;
    };
    domain: string;
    clientUrl: string;
}
