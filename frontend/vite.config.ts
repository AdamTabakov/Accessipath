import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_PROXY = process.env.VITE_API_URL ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": API_PROXY,
      "/uploads": API_PROXY,
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});