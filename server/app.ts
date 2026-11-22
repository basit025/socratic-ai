import express, { type NextFunction, type Request, type Response } from "express";
import { healthRouter } from "./routes/health.js";
import { cronRouter } from "./routes/cron.js";

/**
 * The Express app. It is exported, never started with app.listen():
 * - on Vercel, api/index.ts re-exports it as a single Vercel Function;
 * - locally, server/dev.ts mounts it next to the Vite dev server.
 */
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use("/api", healthRouter);
app.use("/api/cron", cronRouter);

// Unknown API routes get a JSON 404, never the SPA's index.html.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// Global error handler: one bad request never leaves the function in a bad state,
// and stack traces never reach the browser.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[api] ${req.method} ${req.path} failed:`, err);
  if (res.headersSent) return;
  const status =
    typeof (err as { status?: unknown })?.status === "number" &&
    (err as { status: number }).status >= 400 &&
    (err as { status: number }).status < 600
      ? (err as { status: number }).status
      : 500;
  res.status(status).json({
    error: status >= 500 ? "Something went wrong on our side. Please try again." : "Invalid request.",
  });
});

export default app;
