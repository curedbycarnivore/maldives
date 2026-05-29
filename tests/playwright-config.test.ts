import { describe, expect, test } from "vitest";
import config from "../playwright.config";

describe("Playwright deterministic gate", () => {
  test("runs serial by default so dependency-heavy cold starts do not race the editor bootstrap", () => {
    expect(config.fullyParallel).toBe(false);
    expect(config.workers).toBe(process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1);
  });
});
