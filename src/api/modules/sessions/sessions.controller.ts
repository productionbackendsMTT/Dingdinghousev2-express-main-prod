import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import mongoose from "mongoose";

class SessionController {
  async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { playerId } = req.params;
      const {
        status = "all",
        from,
        to,
        gameId,
        sort = "-date",
        limit = "50",
        offset = "0",
      } = req.query;

      if (!mongoose.Types.ObjectId.isValid(playerId)) {
        throw createHttpError(400, "Invalid player ID");
      }

      // Build query
      const query: any = { userId: playerId };

      // Status filter
      if (status === "active") query.isActive = true;
      if (status === "completed") query.isActive = false;

      // Date range filter
      if (from || to) {
        query.connectedAt = {};
        if (from) query.connectedAt.$gte = new Date(from as string);
        if (to) query.connectedAt.$lte = new Date(to as string);
      }

      // Game filter
      if (gameId) {
        query["completedGames.gameId"] = gameId;
      }
    } catch (error) {}
  }
}
