import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("package declaration build", () => {
  test("emits the public package declaration contract", { timeout: 300_000 }, () => {
    execFileSync("bun", ["run", "build"], { stdio: "pipe", timeout: 300_000 });

    expect(existsSync("dist/index.d.ts")).toBe(true);

    const declaration = readFileSync("dist/index.d.ts", "utf-8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
      files?: string[];
      scripts?: Record<string, string>;
      types?: string;
    };
    const packJson = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf-8", stdio: "pipe", timeout: 60_000 });
    const [{ files }] = JSON.parse(packJson) as [{ files: Array<{ path: string }> }];

    expect(packageJson.types).toBe("dist/index.d.ts");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.scripts?.prepublishOnly).toBe("bun run build && test -f dist/index.d.ts");
    expect(files.map((file) => file.path)).toContain("dist/index.d.ts");
    expect(declaration).toContain("createMaldivesEditor");
    expect(declaration).toContain("CreateMaldivesEditorOptions");
    expect(declaration).toContain("EffectDtsFiles");
    expect(declaration).toContain("registerEffectDtsFiles");
  });
});
