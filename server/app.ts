import express, { type NextFunction, type Request, type Response } from "express";
import { healthRouter } from "./routes/health.js";
import { cronRouter } from "./routes/cron.js";
import { demoRouter } from "./routes/demo.js";
import { homeRouter } from "./routes/home.js";
import { workspaceRouter } from "./routes/workspace.js";
import { vivaRouter } from "./routes/viva.js";

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
app.use("/api", demoRouter);
app.use("/api", homeRouter);
app.use("/api", workspaceRouter);
app.use("/api", vivaRouter);

// Unknown API routes get a JSON 404, never the SPA's index.html.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// Global error handler: one bad request never leaves the function in a bad state, stack traces
// never reach the browser, and errors that carry a `publicMessage` (PublicError, LlmUnavailableError)
// show that friendly message instead of a generic one.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const e = err as { status?: unknown; publicMessage?: unknown; code?: unknown; type?: unknown };
  const status = typeof e?.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;
  if (status >= 500) console.error(`[api] ${req.method} ${req.path} failed:`, err);
  if (res.headersSent) return;
  const message =
    typeof e?.publicMessage === "string"
      ? e.publicMessage
      : e?.type === "entity.parse.failed"
        ? "The request wasn't valid JSON."
        : status >= 500
          ? "Something went wrong on our side. Please try again."
          : "Invalid request.";
  res.status(status).json({ error: message, ...(typeof e?.code === "string" ? { code: e.code } : {}) });
});

export default app;
