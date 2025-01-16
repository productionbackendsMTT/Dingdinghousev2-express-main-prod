import { config as conf } from "dotenv";
conf();

const _config = {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || "development",
    jwtSecret: process.env.JWT_SECRET,
    db: process.env.MONGODB_URI,
}

export const config = Object.freeze(_config);