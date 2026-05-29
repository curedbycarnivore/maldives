import { describe, expect, test } from "vitest";
import config from "../vite.config";

describe("vite dependency scanner", () => {
  test("only scans the app entry so vendored Monaco examples do not poison pre-bundling", () => {
    expect(config.optimizeDeps?.entries).toEqual(["index.html"]);
  });
});
