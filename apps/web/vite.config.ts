import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const pkg = (p: string) =>
  fileURLToPath(new URL(`../../packages/${p}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@sygil/model": pkg("model"),
      "@sygil/sysml-notation": pkg("sysml-notation"),
      "@sygil/git": pkg("git"),
      "@sygil/export": pkg("export"),
    },
  },
  server: { port: 5173 },
});
