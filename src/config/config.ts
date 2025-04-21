import { config as conf } from "dotenv";
import { AppConfig } from "../common/types/app-config";
import { Roles } from "../common/types/roles";
import { Resource } from "../common/types/resources";
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

export const defaultPermission = {
    [Roles.ROOT]: {
        [Resource.USERS]: "rwx",
        [Resource.ROLES]: "rwx",
        [Resource.WALLETS]: "rwx",
        [Resource.REQUESTS]: "rwx",
        [Resource.TRANSACTIONS]: "rwx",
        [Resource.BANNERS]: "rwx",
        [Resource.PLATFORMS]: "rwx",
    },
    [Roles.ADMIN]: {
        [Resource.USERS]: "rwx",
        [Resource.ROLES]: "r--",
        [Resource.WALLETS]: "rwx",
        [Resource.REQUESTS]: "rwx",
        [Resource.TRANSACTIONS]: "rwx",
        [Resource.BANNERS]: "rwx",
        [Resource.PLATFORMS]: "rwx",
    },
    [Roles.STORE]: {
        [Resource.USERS]: "rwx",
        [Resource.ROLES]: "r--",
        [Resource.WALLETS]: "r--",
        [Resource.REQUESTS]: "rwx",
        [Resource.TRANSACTIONS]: "rwx",
        [Resource.BANNERS]: "rwx",
        [Resource.PLATFORMS]: "rwx",
    },
    [Roles.PLAYER]: {
        [Resource.USERS]: "r--",
        [Resource.ROLES]: "r--",
        [Resource.WALLETS]: "r--",
        [Resource.REQUESTS]: "rwx",
        [Resource.TRANSACTIONS]: "r--",
        [Resource.BANNERS]: "r--",
        [Resource.PLATFORMS]: "r--",
    },
};

export const roleHierarchy: Record<string, string[]> = {
    [Roles.ROOT]: [Roles.ADMIN, Roles.STORE, Roles.PLAYER],
    [Roles.ADMIN]: [Roles.STORE, Roles.PLAYER],
    [Roles.STORE]: [Roles.PLAYER],
    [Roles.PLAYER]: [],
};

export const config = Object.freeze(_config);
