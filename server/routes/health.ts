import { Router } from "express";
import { getHealth } from "../lib/health.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res, next) => {
  try {
    const report = await getHealth();
    res.set("Cache-Control", "no-store");
    // 503 only when the database is down; a missing AI provider is "degraded" because the other one can take over.
    res.status(report.status === "down" ? 503 : 200).json(report);
  } catch (err) {
    next(err);
  }
});
