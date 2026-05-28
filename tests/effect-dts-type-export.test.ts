import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { CreateMaldivesEditorOptions, EffectDtsFiles } from "../src";
import { registerEffectDtsFiles } from "../src/typescript-worker";

describe("EffectDtsFiles package-root export", () => {
  test("documents and exposes the consumer type used by full DTS ingestion", () => {
    const indexSource = readFileSync("src/index.ts", "utf-8");
    const readme = readFileSync("README.md", "utf-8");
    const effectDtsFiles: EffectDtsFiles = {
      "/node_modules/effect/dist/dts/index.d.ts": "export {};",
    };
    const options: CreateMaldivesEditorOptions = { effectDtsFiles };

    expect(indexSource).toMatch(/export\s+type\s*\{\s*EffectDtsFiles\s*\}\s+from\s+["']\.\/typescript-worker["']/);
    expect(readme).toContain("import { createMaldivesEditor, registerEffectDtsFiles } from \"maldives\"");
    expect(readme).toContain("import type { EffectDtsFiles } from \"maldives\"");
    expect(readme).toContain("as EffectDtsFiles");
    expect(options.effectDtsFiles).toBe(effectDtsFiles);
    expect(registerEffectDtsFiles).toBeTypeOf("function");
  });
});
