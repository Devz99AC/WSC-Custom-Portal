import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the BFF in dev so the SPA and BFF are same-origin (no CORS).
    // Explicit IPv4 (not "localhost") to avoid the IPv6 ::1 vs 127.0.0.1 mismatch.
    proxy: {
      "/api": "http://127.0.0.1:8080",
      // Magic-link endpoints (ADR-0005) — same-origin so the session cookie is set
      // against the SPA's own origin, matching the prod vercel.json rewrite.
      "/auth": "http://127.0.0.1:8080",
    },
  },
});
