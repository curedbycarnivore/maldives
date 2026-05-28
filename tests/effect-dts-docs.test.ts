import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { CreateMaldivesEditorOptions } from "../src";
import { registerEffectDtsFiles } from "../src/typescript-worker";

describe("Effect full declaration documentation", () => {
  test("documents the opt-in Effect DTS ingestion API", () => {
    const readme = readFileSync("README.md", "utf-8");

    expect(readme).toContain("effectDtsFiles");
    expect(readme).toContain("import.meta.glob('/node_modules/effect/dist/dts/**/*.d.ts'");
    expect(readme).toContain("createMaldivesEditor(container, { effectDtsFiles })");
    expect(readme).toContain("registerEffectDtsFiles");
  });

  test("keeps the documented Effect DTS API available to consumers", () => {
    const options: CreateMaldivesEditorOptions = { effectDtsFiles: {} };

    expect(options.effectDtsFiles).toEqual({});
    expect(registerEffectDtsFiles).toBeTypeOf("function");
  });
});
