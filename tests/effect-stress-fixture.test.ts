import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { buildEffectLsOracle } from "../scripts/effect-ls-oracle";

const fixturePath = "e2e/fixtures/effect-stress-app.tsx";

const mandatoryRules = [
  "floatingEffect",
  "missingEffectContext",
  "missingEffectError",
  "missingLayerContext",
  "missingStarInYieldEffectGen",
];

describe("P30e Effect stress fixture", () => {
  test("is a 300-500 line realistic Effect TSX app with stable diagnostics", () => {
    const source = readFileSync(fixturePath, "utf-8");
    const parsed = ts.createSourceFile(fixturePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const diagnostics = buildEffectLsOracle(fixturePath);
    const rules = diagnostics.map((diagnostic) => diagnostic.rule);
    const lineCount = source.trimEnd().split("\n").length;

    expect(parsed.parseDiagnostics).toEqual([]);
    expect(lineCount).toBeGreaterThanOrEqual(300);
    expect(lineCount).toBeLessThanOrEqual(500);
    expect(source).toContain("@serviceComponent()");
    expect(source).toContain("class Repository<T extends");
    expect(source.match(/Context\.Tag/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/Layer\./g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(source.match(/Schema\.Struct/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(source.match(/Effect\.gen\(function\* \(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(source).toContain("yield Effect.succeed");
    expect(source).toContain("Effect.Effect<string, never, never>");
    expect(rules).toEqual(expect.arrayContaining(mandatoryRules));
    expect(new Set(rules.filter((rule) => mandatoryRules.includes(rule)))).toEqual(new Set(mandatoryRules));
  });
});
