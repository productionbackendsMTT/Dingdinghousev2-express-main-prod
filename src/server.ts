import express, { Request, Response } from 'express';
import { createServer } from "http";
import os from 'os';
import moduleRoutes from './modules';
import { errorHandler } from './middlewares';
import cookieParser from 'cookie-parser';
import cors from 'cors'


const app = express();

// Middleware for parsing JSON
app.use(express.json());
app.use(cookieParser())
app.use(cors())


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