import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// During `vite dev`, proxy /api to the local wrangler Pages dev server (port 8788)
// so the SPA can call the real Functions + D1. In production both are served by
// Cloudflare Pages from the same origin, so no proxy is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
});
