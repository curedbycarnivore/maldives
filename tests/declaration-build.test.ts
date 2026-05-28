import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("package declaration build", () => {
  test("emits the public package declaration contract", { timeout: 120_000 }, () => {
    execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 120_000 });

    expect(existsSync("dist/index.d.ts")).toBe(true);

    const declaration = readFileSync("dist/index.d.ts", "utf-8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as { types?: string };

    expect(packageJson.types).toBe("dist/index.d.ts");
    expect(declaration).toContain("createMaldivesEditor");
    expect(declaration).toContain("CreateMaldivesEditorOptions");
    expect(declaration).toContain("EffectDtsFiles");
    expect(declaration).toContain("registerEffectDtsFiles");
  });
});
