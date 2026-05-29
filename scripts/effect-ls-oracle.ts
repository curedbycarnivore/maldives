#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createEffectLanguageServiceSnapshot } from "../src/effect-language-service";

export interface EffectLsOracleDiagnostic {
  rule: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  message: string;
}

export function buildEffectLsOracle(fixturePath = "e2e/fixtures/effect-parity-corpus.tsx"): EffectLsOracleDiagnostic[] {
  const source = readFileSync(fixturePath, "utf-8");
  const snapshot = createEffectLanguageServiceSnapshot({
    path: `/workspace/${fixturePath}`,
    source,
  });

  return snapshot.diagnostics
    .map((diagnostic) => {
      const start = positionAt(source, diagnostic.start);
      const end = positionAt(source, diagnostic.start + diagnostic.length);

      return {
        rule: diagnostic.rule,
        startLine: start.line,
        startCol: start.col,
        endLine: end.line,
        endCol: end.col,
        message: diagnostic.message,
      };
    })
    .sort(compareOracleDiagnostics);
}

export function writeEffectLsOracle(
  fixturePath = "e2e/fixtures/effect-parity-corpus.tsx",
  outFile = "proof/p28a2-effect-ls-oracle.json",
): void {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(buildEffectLsOracle(fixturePath), null, 2)}\n`);
}

function positionAt(source: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;

  for (let i = 0; i < offset; i += 1) {
    if (source[i] === "\n") {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
  }

  return { line, col };
}

function compareOracleDiagnostics(left: EffectLsOracleDiagnostic, right: EffectLsOracleDiagnostic): number {
  return (
    left.startLine - right.startLine ||
    left.startCol - right.startCol ||
    left.endLine - right.endLine ||
    left.endCol - right.endCol ||
    left.rule.localeCompare(right.rule) ||
    left.message.localeCompare(right.message)
  );
}

if (import.meta.main) {
  writeEffectLsOracle(process.argv[2] ?? "e2e/fixtures/effect-parity-corpus.tsx", process.argv[3] ?? "proof/p28a2-effect-ls-oracle.json");
}
