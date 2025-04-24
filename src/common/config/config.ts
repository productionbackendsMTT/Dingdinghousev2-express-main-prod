import { config as conf } from "dotenv";
import { AppConfig } from "../types/config.type";
import { Roles } from "../lib/default-role-hierarchy";
conf();

const _config: AppConfig = {
    port: Number(process.env.PORT) || 5000,
    env: process.env.NODE_ENV || "development",
    db: process.env.MONGODB_URI || "mongodb://localhost:27017/dingding-payments",
    access: {
        secret: process.env.JWT_SECRET || "",
        expiresIn: process.env.NODE_ENV === "development" ? "6h" : "15m",
    },
    refresh: {
        secret: process.env.JWT_REFRESH_SECRET || "",
        expiresIn: "7d",
    },
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    root: {
        role: Roles.ROOT,
        name: process.env.ROOT_NAME,
        username: process.env.ROOT_USERNAME,
        password: process.env.ROOT_PASSWORD,
    },
    domain: process.env.DOMAIN || "localhost",
    clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};

export const config = Object.freeze(_config);
