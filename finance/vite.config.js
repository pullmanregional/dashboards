import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "ui",
  base: "/finance/",
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "ui/index.html"),
        kpi: resolve(__dirname, "ui/kpi.html"),
        admin: resolve(__dirname, "ui/admin.html"),
      },
    },
  },
  server: {
    proxy: {
      // In development mode, proxy /finance/api requests to server at :8505
      "/finance/api": "http://localhost:8505",
    },
    // CORS headers required for SQLite WASM in dev. See https://github.com/sqlite/sqlite-wasm#usage-with-vite
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // Exclude SQLite WASM in dev. See link above.
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
