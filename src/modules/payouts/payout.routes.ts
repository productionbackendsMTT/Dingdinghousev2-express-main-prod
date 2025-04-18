import express from "express";
import { PayoutController } from "./payout.controller";
import { PayoutService } from "./payout.service";

const payoutRouter = express.Router();
const payoutController = new PayoutController(new PayoutService());

payoutRouter.post("/", payoutController.createPayout);
payoutRouter.patch("/:payoutId/activate", payoutController.activatePayout);
payoutRouter.get("/game/:gameId", payoutController.getPayoutsByGame);
payoutRouter.get("/game/:gameId/active", payoutController.getActivePayout);
payoutRouter.patch("/:payoutId", payoutController.updatePayout);
payoutRouter.delete("/:payoutId", payoutController.deletePayout);

export default payoutRouter;