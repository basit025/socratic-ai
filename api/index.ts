// Vercel Function entry point. vercel.json rewrites every /api/* request here,
// and Express routes on the original path (/api/health, /api/cron/reset-demo, ...).
import app from "../server/app.js";

export default app;
