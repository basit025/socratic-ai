import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const clientDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: clientDir,
  plugins: [react(), tailwindcss()],
  worker: { format: "es" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
