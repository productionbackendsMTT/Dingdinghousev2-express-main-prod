import { config } from "./src/common/config/config";
import connectDB from "./src/common/config/db"
import { server } from "./src/app";
import { initializeSystem } from "./src/common/system/init";

const startServer = async () => {

    await connectDB();
    await initializeSystem();

    server.listen(config.port, () => {
        console.log(`API Service listening on port ${config.port}`);
    })
}

startServer()