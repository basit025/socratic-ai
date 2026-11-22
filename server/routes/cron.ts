import { Router } from "express";
import { isAuthorizedCron } from "../lib/cronAuth.js";
import { rpc } from "../lib/db.js";

export const cronRouter = Router();

/**
 * Nightly demo reset, called by Vercel Cron at 22:00 UTC (03:00 PKT); see vercel.json.
 * Deletes expired demo sandboxes (everything inside them cascades) and old rate-limit rows.
 * The daily query also keeps the free Supabase project from pausing.
 */
cronRouter.get("/reset-demo", async (req, res, next) => {
  try {
    if (!isAuthorizedCron(req.get("authorization"), process.env.CRON_SECRET)) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const result = await rpc<{ sandboxes_deleted: number; rate_limit_rows_deleted: number }>("reset_demo");
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      sandboxesDeleted: result.sandboxes_deleted,
      rateLimitRowsDeleted: result.rate_limit_rows_deleted,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
