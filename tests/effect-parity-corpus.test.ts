import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, test } from "vitest";

const fixturePath = "e2e/fixtures/effect-parity-corpus.tsx";
const expectedPath = "e2e/fixtures/effect-parity-corpus.expected.json";

describe("P28a1 Effect parity fixture-of-record", () => {
  test("is complex real TSX and documents the expected Effect correctness rules", () => {
    const source = readFileSync(fixturePath, "utf-8");
    const expected = JSON.parse(readFileSync(expectedPath, "utf-8")) as {
      expectedRules: string[];
      proof: string[];
    };
    const parsed = ts.createSourceFile(fixturePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    expect(parsed.parseDiagnostics).toEqual([]);
    expect(expected.expectedRules).toEqual(
      expect.arrayContaining(["floatingEffect", "missingEffectContext", "missingEffectError"]),
    );
    expect(new Set(expected.expectedRules).size).toBeGreaterThanOrEqual(3);
    expect(expected.proof).toEqual(
      expect.arrayContaining(["tsx", "decorator", "generic-class", "Effect.gen", "Layer", "Schema", "pipe"]),
    );
    expect(source).toContain("@sealed()");
    expect(source).toContain("class Repository<T extends");
    expect(source).toContain("Effect.gen(function* ()");
    expect(source).toContain("yield Effect.succeed");
    expect(source).toContain("Effect.Effect<string, never, never>");
    expect(source).toContain("yield* AuditLog");
    expect(source).toContain("missingErrorButPromisesNever");
  });
});
