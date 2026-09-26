import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/lang-notify-privacy/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        privacy: resolve(import.meta.dirname, "privacy.html"),
      },
    },
  },
});
