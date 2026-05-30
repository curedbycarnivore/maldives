import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildEffectLsOracle, positionAt, writeEffectLsOracle } from "../scripts/effect-ls-oracle";

const fixturePath = "e2e/fixtures/effect-parity-corpus.tsx";
const expectedPath = "e2e/fixtures/effect-parity-corpus.expected.json";

describe("P28a2 Effect language-service node oracle", () => {
  test("emits the canonical Effect diagnostic rules with stable real-source ranges", () => {
    const expected = JSON.parse(readFileSync(expectedPath, "utf-8")) as { expectedRules: string[] };
    const oracle = buildEffectLsOracle(fixturePath);

    expect(oracle.map((diagnostic) => diagnostic.rule)).toEqual(expect.arrayContaining(expected.expectedRules));
    expect(oracle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "floatingEffect",
          startLine: 37,
          startCol: 3,
          endLine: 37,
          endCol: 30,
          message: expect.stringContaining("neither yielded nor used"),
        }),
        expect.objectContaining({
          rule: "missingStarInYieldEffectGen",
          startLine: 42,
          startCol: 16,
          endLine: 42,
          endCol: 43,
          message: expect.stringContaining("yield*"),
        }),
        expect.objectContaining({
          rule: "missingEffectContext",
          startLine: 46,
          startCol: 14,
          endLine: 46,
          endCol: 39,
          message: expect.stringContaining("AuditLog"),
        }),
        expect.objectContaining({
          rule: "missingEffectContext",
          startLine: 52,
          startCol: 14,
          endLine: 52,
          endCol: 34,
          message: expect.stringContaining("AuditLog | UserRepo"),
        }),
        expect.objectContaining({
          rule: "missingEffectError",
          startLine: 57,
          startCol: 14,
          endLine: 57,
          endCol: 42,
          message: expect.stringContaining("Missing 'Error'"),
        }),
        expect.objectContaining({
          rule: "missingLayerContext",
          startLine: 59,
          startCol: 14,
          endLine: 59,
          endCol: 33,
          message: expect.stringContaining("AuditLog"),
        }),
      ]),
    );
    const mandatoryDiagnostics = oracle.filter((diagnostic) => expected.expectedRules.includes(diagnostic.rule));
    expect(new Set(mandatoryDiagnostics.map((diagnostic) => diagnostic.rule))).toEqual(new Set(expected.expectedRules));
    expect(mandatoryDiagnostics).toHaveLength(6);
  });

  test("maps offsets the same way Monaco does for CRLF and unicode source", () => {
    const source = "const alpha = 1;\r\nconst emoji = \"😀\";\r\nconst tail = emoji;";

    expect([0, 16, 17, 18, 33, 34, 35, 39, source.indexOf("tail")].map((offset) => positionAt(source, offset))).toEqual([
      { line: 1, col: 1 },
      { line: 1, col: 17 },
      { line: 1, col: 18 },
      { line: 2, col: 1 },
      { line: 2, col: 16 },
      { line: 2, col: 17 },
      { line: 2, col: 18 },
      { line: 3, col: 1 },
      { line: 3, col: 7 },
    ]);
  });

  test("writes the oracle JSON proof artifact", () => {
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-effect-ls-oracle-")), "oracle.json");

    writeEffectLsOracle(fixturePath, outFile);

    const written = JSON.parse(readFileSync(outFile, "utf-8")) as ReturnType<typeof buildEffectLsOracle>;
    expect(written[0]).toEqual(
      expect.objectContaining({
        rule: expect.any(String),
        startLine: expect.any(Number),
        startCol: expect.any(Number),
        endLine: expect.any(Number),
        endCol: expect.any(Number),
        message: expect.any(String),
      }),
    );
    expect(written).toEqual(buildEffectLsOracle(fixturePath));
  });
});
