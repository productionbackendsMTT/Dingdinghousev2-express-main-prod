import { config as conf } from "dotenv";
conf();

const _config = {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || "development",
    db: process.env.MONGODB_URI,
    access: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.NODE_ENV === "development" ? '1h' : '15m'
    },
    refresh: {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d'
    },

}

export const config = Object.freeze(_config);