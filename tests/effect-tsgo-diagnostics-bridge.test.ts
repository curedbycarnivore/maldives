import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildEffectTsgoWorkspaceFiles,
  buildTsgoCommand,
  effectTsgoBridgeContract,
  parseTsgoDiagnostics,
  writeEffectTsgoBridgeContract,
} from "../scripts/effect-tsgo-diagnostics-bridge";

const complexEffectSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function injectable(_: unknown, _context: ClassDecoratorContext) {}

@injectable
class AuditRepo<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  load(id: string) {
    Effect.succeed(id);
    return Effect.gen(function* () {
      return yield* Effect.succeed({ id } as A);
    });
  }
}

export const RepoLive = Layer.succeed(Context.GenericTag<AuditRepo<{ readonly id: string }>>("AuditRepo"), new AuditRepo());
`;

describe("P28b Effect tsgo diagnostics bridge", () => {
  test("documents a stable Take5 request/response marker contract", () => {
    expect(effectTsgoBridgeContract.request).toEqual({ path: "/src/effect-app.tsx", content: "string" });
    expect(effectTsgoBridgeContract.response.diagnostics[0]).toEqual({
      path: "/src/effect-app.tsx",
      severity: "error",
      code: "TS9999",
      rule: "floatingEffect",
      startLine: 9,
      startCol: 5,
      endLine: 9,
      endCol: 6,
      message: "Effect is neither yielded nor used",
    });
  });

  test("prepares a per-session workspace with the real Effect language-service plugin enabled", () => {
    const files = buildEffectTsgoWorkspaceFiles({ path: "/src/effect-app.tsx", content: complexEffectSource });

    expect(files["/workspace/src/effect-app.tsx"]).toBe(complexEffectSource);
    expect(JSON.parse(files["/workspace/package.json"] ?? "{}")).toMatchObject({
      dependencies: { effect: "3.21.2" },
      devDependencies: { "@effect/language-service": "0.86.2" },
    });
    expect(JSON.parse(files["/workspace/tsconfig.json"] ?? "{}")).toMatchObject({
      compilerOptions: {
        plugins: [
          {
            name: "@effect/language-service",
            diagnosticSeverity: {
              floatingEffect: "error",
              missingEffectContext: "error",
              missingEffectError: "error",
              missingLayerContext: "error",
              missingStarInYieldEffectGen: "error",
            },
          },
        ],
      },
      include: ["src/effect-app.tsx"],
    });
  });

  test("parses tsc-style tsgo output into Monaco marker ranges", () => {
    const stderr = [
      `/workspace/src/effect-app.tsx(9,5): error TS9999: [floatingEffect] Effect is neither yielded nor used`,
      `/workspace/src/effect-app.tsx(18,14): error TS9999: [missingLayerContext] Missing Effect context: AuditLog`,
      `C:\\workspace\\src\\effect-app.tsx(23,3): warning TS2777: [missingEffectError] Missing 'Error' in error channel`,
      `Found 3 errors in 1 file.`,
    ].join("\n");

    expect(parseTsgoDiagnostics(stderr)).toEqual([
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
      {
        path: "/src/effect-app.tsx",
        severity: "error",
        code: "TS9999",
        rule: "missingLayerContext",
        startLine: 18,
        startCol: 14,
        endLine: 18,
        endCol: 15,
        message: "Missing Effect context: AuditLog",
      },
      {
        path: "/src/effect-app.tsx",
        severity: "warning",
        code: "TS2777",
        rule: "missingEffectError",
        startLine: 23,
        startCol: 3,
        endLine: 23,
        endCol: 4,
        message: "Missing 'Error' in error channel",
      },
    ]);
  });

  test("builds the tsgo command and writes the bridge contract proof artifact", () => {
    expect(buildTsgoCommand("/tmp/maldives-tsgo-session")).toEqual({
      command: "tsgo",
      args: ["-p", "/tmp/maldives-tsgo-session/tsconfig.json", "--noEmit", "--pretty", "false"],
    });

    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-p28b-contract-")), "contract.json");
    writeEffectTsgoBridgeContract(outFile);

    expect(JSON.parse(readFileSync(outFile, "utf-8"))).toEqual(effectTsgoBridgeContract);
  });
});
