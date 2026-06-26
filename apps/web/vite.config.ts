import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const pkg = (p: string) =>
  fileURLToPath(new URL(`../../packages/${p}/src/index.ts`, import.meta.url));

const stub = (p: string) =>
  fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const platform = env.VITE_PLATFORM === "true";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@sygil/model": pkg("model"),
        "@sygil/sysml-notation": pkg("sysml-notation"),
        "@sygil/export": pkg("export"),
        // CE builds (VITE_PLATFORM!=="true") alias the proprietary platform
        // package to an empty stub so none of its code lands in the bundle.
        "@sygil/platform": platform
          ? pkg("platform")
          : stub("./src/platform-stub.ts"),
      },
    },
    server: { port: 5173 },
  };
});
