import { describe, expect, test } from "vitest";
import type * as monaco from "monaco-editor";
import { configureTypeScriptWorker, registerEffectDtsFiles, warmTypeScriptWorkerForModel } from "../src/typescript-worker";

type CompilerOptions = monaco.typescript.CompilerOptions;
type DiagnosticsOptions = monaco.languages.typescript.DiagnosticsOptions;
type InlayHintsOptions = monaco.languages.typescript.InlayHintsOptions;

function createMonacoStub() {
  let compilerOptions: CompilerOptions = {};
  let diagnosticsOptions: DiagnosticsOptions = {};
  let inlayHintsOptions: InlayHintsOptions = {};
  let eagerModelSync = false;
  const extraLibs: Record<string, { content: string }> = {};

  return {
    typescript: {
      ScriptTarget: { ESNext: 99 },
      ModuleKind: { ESNext: 99 },
      JsxEmit: { ReactJSX: 4 },
      typescriptDefaults: {
        setCompilerOptions(options: CompilerOptions) {
          compilerOptions = options;
        },
        getCompilerOptions() {
          return compilerOptions;
        },
        setDiagnosticsOptions(options: DiagnosticsOptions) {
          diagnosticsOptions = options;
        },
        getDiagnosticsOptions() {
          return diagnosticsOptions;
        },
        setInlayHintsOptions(options: InlayHintsOptions) {
          inlayHintsOptions = options;
        },
        getInlayHintsOptions() {
          return inlayHintsOptions;
        },
        setEagerModelSync(value: boolean) {
          eagerModelSync = value;
        },
        getEagerModelSync() {
          return eagerModelSync;
        },
        addExtraLib(content: string, filePath = "file:///anonymous.d.ts") {
          extraLibs[filePath] = { content };
          return {
            dispose() {
              delete extraLibs[filePath];
            },
          };
        },
        getExtraLibs() {
          return extraLibs;
        },
      },
    },
  } as unknown as typeof monaco;
}

describe("configureTypeScriptWorker", () => {
  test("warms the TypeScript worker against the live model before suggestion/navigation tests run", async () => {
    const calls: string[] = [];
    const model = { uri: { toString: () => "file:///maldives/sample.ts" } } as monaco.editor.ITextModel;
    const monacoStub = {
      languages: {
        typescript: {
          async getTypeScriptWorker() {
            calls.push("get-worker-factory");
            return async (uri: monaco.Uri) => {
              calls.push(`get-worker:${uri.toString()}`);
              return {
                async getNavigationTree(path: string) {
                  calls.push(`get-navigation-tree:${path}`);
                },
              };
            };
          },
        },
      },
    } as unknown as typeof monaco;

    await warmTypeScriptWorkerForModel(monacoStub, model);

    expect(calls).toEqual([
      "get-worker-factory",
      "get-worker:file:///maldives/sample.ts",
      "get-navigation-tree:file:///maldives/sample.ts",
    ]);
  });

  test("does not let a stuck TypeScript worker block the live editor forever", async () => {
    const model = { uri: { toString: () => "file:///maldives/sample.ts" } } as monaco.editor.ITextModel;
    const monacoStub = {
      languages: {
        typescript: {
          async getTypeScriptWorker() {
            return async () => ({
              getNavigationTree: () => new Promise(() => undefined),
            });
          },
        },
      },
    } as unknown as typeof monaco;

    await expect(warmTypeScriptWorkerForModel(monacoStub, model, { timeoutMs: 1 })).resolves.toBeUndefined();
  });

  test("enables strict ESNext compiler options and eager model sync", () => {
    const monacoStub = createMonacoStub();

    configureTypeScriptWorker(monacoStub);

    const compilerOptions = monacoStub.typescript.typescriptDefaults.getCompilerOptions();
    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.target).toBe(monacoStub.typescript.ScriptTarget.ESNext);
    expect(compilerOptions.module).toBe(monacoStub.typescript.ModuleKind.ESNext);
    expect(compilerOptions.moduleResolution).toBe(100);
    expect(compilerOptions.lib).toEqual(["ESNext", "DOM", "DOM.Iterable"]);
    expect(compilerOptions.exactOptionalPropertyTypes).toBe(true);
    expect(compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(compilerOptions.allowImportingTsExtensions).toBe(true);
    expect(compilerOptions.verbatimModuleSyntax).toBe(true);
    expect(compilerOptions.allowNonTsExtensions).toBe(true);
    expect(monacoStub.typescript.typescriptDefaults.getDiagnosticsOptions()).toEqual({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: false,
    });
    expect(monacoStub.typescript.typescriptDefaults.getInlayHintsOptions()).toMatchObject({
      includeInlayParameterNameHints: "all",
      includeInlayParameterNameHintsWhenArgumentMatchesName: false,
      includeInlayFunctionParameterTypeHints: true,
      includeInlayVariableTypeHints: true,
      includeInlayPropertyDeclarationTypeHints: true,
      includeInlayFunctionLikeReturnTypeHints: true,
      includeInlayEnumMemberValueHints: true,
    });
    expect(monacoStub.typescript.typescriptDefaults.getEagerModelSync()).toBe(true);
  });

  test("registers self-contained Effect type stubs with the TypeScript worker", () => {
    const monacoStub = createMonacoStub();

    configureTypeScriptWorker(monacoStub);

    const extraLibs = monacoStub.typescript.typescriptDefaults.getExtraLibs();
    const effectStub = extraLibs["file:///node_modules/@types/effect-stub/index.d.ts"]?.content;

    expect(effectStub).toContain('declare module "effect"');
    expect(effectStub).toContain("function gen");
    expect(effectStub).toContain("function map");
    expect(effectStub).toContain("export const pipe");
    expect(effectStub).toContain("export namespace Option");
    expect(effectStub).toContain("export namespace Either");
    expect(effectStub).toContain("export namespace Schema");
    expect(effectStub).not.toContain("import ");
    expect(effectStub).not.toContain("from \"./");
  });

  test("remaps full Effect declaration files to stable virtual node_modules paths", () => {
    const monacoStub = createMonacoStub();

    const disposable = registerEffectDtsFiles(monacoStub, {
      "/node_modules/effect/dist/dts/index.d.ts": 'export * as Effect from "./Effect.js";',
      "/node_modules/effect/dist/dts/Effect.d.ts": "export declare const match: unique symbol;",
      "effect/dist/dts/Predicate.d.ts": "export declare const isString: (value: unknown) => value is string;",
    });

    const extraLibs = monacoStub.typescript.typescriptDefaults.getExtraLibs();
    expect(extraLibs["file:///node_modules/effect/index.d.ts"]?.content).toContain("./Effect.js");
    expect(extraLibs["file:///node_modules/effect/Effect.d.ts"]?.content).toContain("match");
    expect(extraLibs["file:///node_modules/effect/Predicate.d.ts"]?.content).toContain("isString");
    expect(extraLibs["file:///node_modules/effect/dist/dts/Effect.d.ts"]).toBeUndefined();

    disposable.dispose();

    expect(monacoStub.typescript.typescriptDefaults.getExtraLibs()).toEqual({});
  });
});
