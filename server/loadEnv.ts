// Loads .env.local (then .env) for local development using Node's built-in loader.
// On Vercel, environment variables come from the project settings and no file is read.
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
