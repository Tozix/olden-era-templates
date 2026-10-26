import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 5230 matches the historical dev/e2e port.
export default defineConfig({
  plugins: [react()],
  server: { port: 5230, strictPort: true },
  preview: { port: 5230, strictPort: true },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
});
