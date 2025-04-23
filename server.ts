import express, { Request, Response } from 'express';
import { createServer } from 'http';
import connectDB from './src/common/config/db';
import { init } from './src/common/system/init';
import api from './src/api';
import { config } from './src/common/config/config';

async function bootstrap() {
    const app = express();
    const httpServer = createServer(app);

    try {
        await connectDB();
        await init();

        api(app);

        // Start server
        const PORT = config.port;
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap().catch(console.error);