import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/static/dist/",
  plugins: [react()],
  build: {
    outDir: "web/static/dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: "frontend/src/main.jsx",
      output: {
        entryFileNames: "app.js",
        assetFileNames: (assetInfo) =>
          assetInfo.name && assetInfo.name.endsWith(".css") ? "app.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
