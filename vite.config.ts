import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { understandApiPlugin } from "./server/understandPlugin";

export default defineConfig(({ mode }) => {
  // Server-only env (no VITE_ prefix) — read by the dev/preview API middleware, never bundled.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), understandApiPlugin({ ...env, MODE: mode })],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // Loopback only: the dev API spends the real AI key. Use `vite --host` per session for LAN testing.
      host: "127.0.0.1",
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "web",
            environment: "jsdom",
            setupFiles: "./src/test/setup.ts",
            include: ["src/**/*.test.{ts,tsx}"],
          },
        },
        {
          extends: true,
          test: {
            name: "server",
            environment: "node",
            include: ["server/**/*.test.ts", "shared/**/*.test.ts", "netlify/**/*.test.ts"],
          },
        },
      ],
    },
  };
});
