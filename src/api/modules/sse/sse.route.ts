import { Router } from "express";
import SSEController from "./sse.controller";
import { authHandler, sseAuthHandler } from "../../middleware/auth.middleware";
import cors from "cors";
import { config } from "../../../common/config/config";

const router = Router();
const controller = new SSEController();

// Apply specific CORS settings for SSE endpoints
const sseSpecificCors = cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ["GET"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Type", "Connection", "Cache-Control"],
});

router.get("/connect", sseSpecificCors, sseAuthHandler, controller.sseHanler);
router.get("/stats", sseAuthHandler, controller.sseStatsHandler);

export default router;
