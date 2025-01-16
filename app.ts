import { config } from "./src/config/config";
import connectDB from "./src/config/db"
import { server } from "./src/server";

const startServer = async () => {
    await connectDB();
    server.listen(config.port, () => {
        console.log(`API Service listening on port ${config.port}`);
    })
}

startServer()