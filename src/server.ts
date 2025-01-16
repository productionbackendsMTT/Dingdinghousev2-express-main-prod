import express, { Request, Response } from 'express';
import { createServer } from "http";
import os from 'os';


const app = express();

// Middleware for parsing JSON
app.use(express.json());


app.get('/', (req: Request, res: Response) => {
    const response = {
        uptime: os.uptime(),
        timestamp: new Date().toISOString(),
        message: 'Server is running'
    };
    res.json(response);
});


export const server = createServer(app);