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
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    },
    root: {
        role: process.env.ROOT_ROLE,
        name: process.env.ROOT_NAME,
        username: process.env.ROOT_USERNAME,
        password: process.env.ROOT_PASSWORD
    }

}

export const config = Object.freeze(_config);