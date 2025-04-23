import express, { Request, Response } from 'express';
import { createServer } from "http";
import os from 'os';
import moduleRoutes from './modules';
import cookieParser from 'cookie-parser';
import cors from 'cors'
import errorHandler from './common/middlewares/error.middleware';

const app = express();

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser())
app.use(cors({
    origin: ['http://localhost:3000', 'https://yourdomain.com'],  // Allow specific origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Allowed HTTP methods  
    allowedHeaders: ['Content-Type', 'Authorization'],  // Allowed headers
    credentials: true,  // Allow credentials (cookies, authorization headers)
    maxAge: 86400  // How long the results of a preflight request can be cached (in seconds)
}));

app.get('/', (req: Request, res: Response) => {
    const response = {
        uptime: os.uptime(),
        timestamp: new Date().toISOString(),
        message: 'Server is running'
    };
    res.json(response);
});

app.use('/api', moduleRoutes);


app.use(errorHandler)


export const server = createServer(app);