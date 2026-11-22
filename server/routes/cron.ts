import { Router } from "express";
import { isAuthorizedCron } from "../lib/cronAuth.js";
import { checkDatabase } from "../lib/health.js";

export const cronRouter = Router();

/**
 * Nightly demo reset, called by Vercel Cron at 22:00 UTC (03:00 PKT); see vercel.json.
 * Hello-world stage: authenticates and touches the database (which also keeps the free
 * Supabase project from pausing). Deleting expired demo sandboxes comes with the schema.
 */
cronRouter.get("/reset-demo", async (req, res, next) => {
  try {
    if (!isAuthorizedCron(req.get("authorization"), process.env.CRON_SECRET)) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }
    const database = await checkDatabase(process.env);
    res.set("Cache-Control", "no-store");
    res.status(database === "ok" ? 200 : 503).json({
      ok: database === "ok",
      database,
      sandboxesDeleted: 0, // TODO(schema): delete sandboxes past their expiry
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});
