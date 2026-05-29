import type { ConfigEnv, UserConfig } from "vite";
import { describe, expect, test } from "vitest";
import config from "../vite.config";

const resolveConfig = async (env: ConfigEnv): Promise<UserConfig> => {
  if (typeof config === "function") {
    return await config(env);
  }

  return config;
};

describe("vite dependency scanner", () => {
  test("only scans the app entry so vendored Monaco examples do not poison pre-bundling", async () => {
    const appConfig = await resolveConfig({ command: "serve", mode: "development", isSsrBuild: false, isPreview: false });

    expect(appConfig.optimizeDeps?.entries).toEqual(["index.html"]);
  });

  test("emits a package runtime module alongside the app build", async () => {
    const libraryConfig = await resolveConfig({ command: "build", mode: "library", isSsrBuild: false, isPreview: false });

    expect(libraryConfig.build).toMatchObject({
      emptyOutDir: false,
      lib: { entry: "src/index.ts", formats: ["es"] },
    });
  });
});
