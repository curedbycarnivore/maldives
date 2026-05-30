#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type EffectTsgoSeverity = "error" | "warning";

export interface EffectTsgoBridgeRequest {
  readonly path: string;
  readonly content: string;
}

export interface EffectTsgoDiagnosticMarker {
  readonly path: string;
  readonly severity: EffectTsgoSeverity;
  readonly code: string;
  readonly rule: string;
  readonly startLine: number;
  readonly startCol: number;
  readonly endLine: number;
  readonly endCol: number;
  readonly message: string;
}

export interface EffectTsgoBridgeResponse {
  readonly diagnostics: EffectTsgoDiagnosticMarker[];
}

export interface TsgoCommand {
  readonly command: "tsgo";
  readonly args: string[];
}

const correctnessDiagnosticSeverity = {
  floatingEffect: "error",
  missingEffectContext: "error",
  missingEffectError: "error",
  missingLayerContext: "error",
  missingStarInYieldEffectGen: "error",
} as const;

export const effectTsgoBridgeContract = {
  request: { path: "/src/effect-app.tsx", content: "string" },
  response: {
    diagnostics: [
      {
        path: "/src/effect-app.tsx",
        severity: "error",
        code: "TS9999",
        rule: "floatingEffect",
        startLine: 9,
        startCol: 5,
        endLine: 9,
        endCol: 6,
        message: "Effect is neither yielded nor used",
      },
    ],
  },
} satisfies { readonly request: EffectTsgoBridgeRequest; readonly response: EffectTsgoBridgeResponse };

export function buildEffectTsgoWorkspaceFiles(request: EffectTsgoBridgeRequest): Record<string, string> {
  const sourcePath = normalizeWorkspacePath(request.path);
  const sourcePathFromWorkspaceRoot = sourcePath.slice(1);
  const versions = dependencyVersions();

  return {
    [`/workspace${sourcePath}`]: request.content,
    "/workspace/package.json": `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: { effect: versions.effect },
        devDependencies: { "@effect/language-service": versions.effectLanguageService },
      },
      null,
      2,
    )}\n`,
    "/workspace/tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          jsx: "react-jsx",
          noEmit: true,
          plugins: [
            {
              name: "@effect/language-service",
              diagnosticSeverity: correctnessDiagnosticSeverity,
            },
          ],
        },
        include: [sourcePathFromWorkspaceRoot],
      },
      null,
      2,
    )}\n`,
  };
}

export function buildTsgoCommand(workspaceDir: string): TsgoCommand {
  return {
    command: "tsgo",
    args: ["-p", `${workspaceDir.replace(/\/+$/g, "")}/tsconfig.json`, "--noEmit", "--pretty", "false"],
  };
}

export function parseTsgoDiagnostics(output: string): EffectTsgoDiagnosticMarker[] {
  return output
    .split(/\r?\n/)
    .map((line) => parseTsgoDiagnosticLine(line))
    .filter((diagnostic): diagnostic is EffectTsgoDiagnosticMarker => Boolean(diagnostic))
    .sort(compareDiagnostics);
}

export function writeEffectTsgoBridgeContract(outFile = "proof/p28b-diagnostics-bridge-contract.json"): void {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(effectTsgoBridgeContract, null, 2)}\n`);
}

function parseTsgoDiagnosticLine(line: string): EffectTsgoDiagnosticMarker | undefined {
  const match = /^(.*)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(?:\[([^\]]+)\]\s*)?(.*)$/.exec(line.trim());

  if (!match) return undefined;

  const [, rawPath, rawLine, rawCol, severity, code, rawRule, rawMessage] = match;
  const startLine = Number(rawLine);
  const startCol = Number(rawCol);

  return {
    path: normalizeTsgoOutputPath(rawPath ?? ""),
    severity: severity as EffectTsgoSeverity,
    code: code ?? "TS0000",
    rule: rawRule ?? code ?? "typescript",
    startLine,
    startCol,
    endLine: startLine,
    endCol: startCol + 1,
    message: (rawMessage ?? "").trim(),
  };
}

function normalizeWorkspacePath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  const withLeadingSlash = normalized.startsWith("/") ? normalized : `/${normalized}`;

  if (withLeadingSlash.split("/").includes("..")) {
    throw new Error(`Refusing traversal path for Effect tsgo bridge: ${path}`);
  }

  return withLeadingSlash;
}

function normalizeTsgoOutputPath(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  const workspaceIndex = normalized.toLowerCase().indexOf("/workspace/");

  if (workspaceIndex >= 0) {
    return normalized.slice(workspaceIndex + "/workspace".length);
  }

  return normalized;
}

function dependencyVersions(): { readonly effect: string; readonly effectLanguageService: string } {
  const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  return {
    effect: packageJson.dependencies?.effect ?? "3.21.2",
    effectLanguageService: packageJson.devDependencies?.["@effect/language-service"] ?? "0.86.2",
  };
}

function compareDiagnostics(left: EffectTsgoDiagnosticMarker, right: EffectTsgoDiagnosticMarker): number {
  return (
    left.path.localeCompare(right.path) ||
    left.startLine - right.startLine ||
    left.startCol - right.startCol ||
    left.endLine - right.endLine ||
    left.endCol - right.endCol ||
    left.rule.localeCompare(right.rule) ||
    left.message.localeCompare(right.message)
  );
}

if (import.meta.main) {
  writeEffectTsgoBridgeContract(process.argv[2] ?? "proof/p28b-diagnostics-bridge-contract.json");
}
