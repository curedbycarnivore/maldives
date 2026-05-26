import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
