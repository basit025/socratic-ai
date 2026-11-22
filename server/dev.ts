// Local development only: one process serves the API and the Vite dev server (with HMR).
// Production never runs this file; Vercel serves client/dist from its CDN and api/index.ts as a function.
import "./loadEnv.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import api from "./app.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3000;

const server = express();
server.use(api);

const vite = await createViteServer({
  configFile: path.join(root, "client/vite.config.ts"),
  server: { middlewareMode: true },
  appType: "spa",
});
server.use(vite.middlewares);

server.listen(PORT, () => {
  console.log(`Socratic AI dev server: http://localhost:${PORT}  (health: /api/health)`);
});
