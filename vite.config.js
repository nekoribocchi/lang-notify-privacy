import { defineConfig } from "vite";
import { resolve } from "node:path";
import { localeOrder } from "./src/translations.js";

const localePages = Object.fromEntries(localeOrder.filter((locale) => locale !== "en").flatMap((locale) => [
  [`account-${locale}`, resolve(import.meta.dirname, locale, "index.html")],
  [`privacy-${locale}`, resolve(import.meta.dirname, locale, "privacy.html")],
]));

export default defineConfig({
  base: "/lang-notify-privacy/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        privacy: resolve(import.meta.dirname, "privacy.html"),
        ...localePages,
      },
    },
  },
});
