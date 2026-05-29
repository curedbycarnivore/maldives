import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig(({ mode }) => ({
  plugins: [wasm()],
  define: {
    __MALDIVES_DEVTOOLS_ENABLED__: JSON.stringify(process.env.MALDIVES_DEVTOOLS === "1"),
  },
  optimizeDeps: {
    entries: ["index.html"],
  },
  build:
    mode === "library"
      ? {
          emptyOutDir: false,
          lib: {
            entry: "src/index.ts",
            fileName: () => "index.js",
            formats: ["es"],
          },
        }
      : undefined,
  server: {
    host: "127.0.0.1",
    port: 5173,
    headers: {
      "Content-Security-Policy": "script-src 'self' 'wasm-unsafe-eval' 'sha256-YenIR0w2uOJMq12UhbL15PlQWd7gf4v3ThVTe/nvZZE='; worker-src 'self' blob:; connect-src 'self' ws://127.0.0.1:34437 ws://localhost:34437; object-src 'none'; base-uri 'self'",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
}));
