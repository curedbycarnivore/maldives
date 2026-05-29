import { describe, expect, test, vi } from "vitest";
import type * as monaco from "monaco-editor";
import { buildVscodeTypeScriptOverlay, startVscodeTypeScriptWorkerForMaldives } from "../src/vscode-ts-worker";

function createMonacoStub() {
  let diagnosticsOptions: monaco.languages.typescript.DiagnosticsOptions = {};

  return {
    languages: {
      typescript: {
        typescriptDefaults: {
          setDiagnosticsOptions(options: monaco.languages.typescript.DiagnosticsOptions) {
            diagnosticsOptions = options;
          },
          getDiagnosticsOptions() {
            return diagnosticsOptions;
          },
        },
      },
    },
  } as unknown as typeof monaco;
}

describe("P11b VSCode TypeScript worker bootstrap", () => {
  test("builds an in-memory FS overlay with Effect declarations at node_modules paths", () => {
    const overlay = buildVscodeTypeScriptOverlay({
      effectDtsFiles: {
        "/node_modules/effect/dist/dts/index.d.ts": 'export * as Effect from "./Effect.js";',
        "/node_modules/effect/dist/dts/Effect.d.ts": "export declare const succeed: unique symbol;",
      },
      packageExports: {
        ".": { types: "./dist/dts/index.d.ts" },
        "./Effect": { types: "./dist/dts/Effect.d.ts" },
      },
    });

    expect(overlay.files.get("file:///node_modules/effect/index.d.ts")).toContain("./Effect.js");
    expect(overlay.files.get("file:///node_modules/effect/Effect.d.ts")).toContain("succeed");
    expect(overlay.files.get("file:///node_modules/effect/package.json")).toContain('"name": "effect"');
    expect(overlay.files.get("file:///workspace/tsconfig.json")).toContain('"strict": true');
    expect([...overlay.files.keys()].every((path) => path.startsWith("file:///node_modules/effect/") || path === "file:///workspace/tsconfig.json")).toBe(true);
  });

  test("boots the Monaco VSCode API wrapper exactly once and disables stock semantic diagnostics", async () => {
    const monacoStub = createMonacoStub();
    const writes: Array<[string, string]> = [];
    const start = vi.fn(async () => undefined);
    const createWrapper = vi.fn(() => ({ start }));
    const loadTypeScriptExtension = vi.fn(async () => ({ whenReady: vi.fn(async () => undefined) }));

    const first = await startVscodeTypeScriptWorkerForMaldives(monacoStub, {
      effectDtsFiles: {
        "/node_modules/effect/dist/dts/index.d.ts": "export {};",
      },
      deps: {
        createWrapper,
        loadTypeScriptExtension,
        initFile: async (path, content) => {
          writes.push([path, content]);
        },
      },
    });
    const second = await startVscodeTypeScriptWorkerForMaldives(monacoStub, {
      deps: { createWrapper, loadTypeScriptExtension, initFile: async () => undefined },
    });

    expect(second).toBe(first);
    expect(createWrapper).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
    expect(loadTypeScriptExtension).toHaveBeenCalledTimes(1);
    expect(writes.map(([path]) => path)).toContain("file:///node_modules/effect/index.d.ts");
    expect(writes.map(([path]) => path)).toContain("file:///workspace/tsconfig.json");
    expect(monacoStub.languages.typescript.typescriptDefaults.getDiagnosticsOptions()).toEqual({
      noSemanticValidation: true,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
    });
    expect(first.stockDiagnosticsDisabled).toBe(true);
  });
});
