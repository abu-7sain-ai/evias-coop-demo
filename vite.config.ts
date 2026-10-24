import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so dist/ works from any path (static hosting or the local bridge)
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
  build: { chunkSizeWarningLimit: 1500 },
});
