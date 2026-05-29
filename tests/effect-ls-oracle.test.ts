import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildEffectLsOracle, writeEffectLsOracle } from "../scripts/effect-ls-oracle";

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
      ]),
    );
    expect(oracle.filter((diagnostic) => expected.expectedRules.includes(diagnostic.rule))).toHaveLength(4);
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
