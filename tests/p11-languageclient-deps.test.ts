import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

const vscodePackages = [
  "@codingame/monaco-vscode-api",
  "@codingame/monaco-vscode-editor-api",
  "@codingame/monaco-vscode-typescript-language-features-default-extension",
] as const;

describe("P11a language client dependency pins", () => {
  test("pins the Monaco language client stack to the selected 10.7.0 / 25.1.2 line", () => {
    expect(deps["monaco-languageclient"]).toBe("10.7.0");
    for (const packageName of vscodePackages) {
      expect(deps[packageName]).toBe("25.1.2");
    }
  });

  test("keeps every resolved @codingame/monaco-vscode package on the same 25.1.2 line", () => {
    const bunLock = readFileSync("bun.lock", "utf-8");
    const resolvedVersions = Array.from(bunLock.matchAll(/"(@codingame\/monaco-vscode-[^"@]+)": \["\1@(\d+\.\d+\.\d+)"/g));

    expect(resolvedVersions.length).toBeGreaterThan(0);
    expect(new Set(resolvedVersions.map(([, , version]) => version))).toEqual(new Set(["25.1.2"]));
  });

  test("the frozen Bun install is reproducible without peer dependency warnings", { timeout: 300_000 }, () => {
    const output = execFileSync("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300_000,
    });

    expect(output.toLowerCase()).not.toContain("peer dependency");
  });
});
