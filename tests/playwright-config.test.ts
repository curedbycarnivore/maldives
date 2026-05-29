import { describe, expect, test } from "vitest";
import config from "../playwright.config";

describe("Playwright deterministic parallel gate", () => {
  test("runs specs fully parallel with three default workers", () => {
    expect(config.fullyParallel).toBe(true);
    expect(config.workers).toBe(3);
  });
});
