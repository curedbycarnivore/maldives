import { describe, expect, test } from "vitest";
import type * as monaco from "monaco-editor";
import { configureTypeScriptWorker } from "../src/typescript-worker";

type CompilerOptions = monaco.typescript.CompilerOptions;
type DiagnosticsOptions = monaco.languages.typescript.DiagnosticsOptions;
type InlayHintsOptions = monaco.languages.typescript.InlayHintsOptions;

function createMonacoStub() {
  let compilerOptions: CompilerOptions = {};
  let diagnosticsOptions: DiagnosticsOptions = {};
  let inlayHintsOptions: InlayHintsOptions = {};
  let eagerModelSync = false;

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
      },
    },
  } as unknown as typeof monaco;
}

describe("configureTypeScriptWorker", () => {
  test("enables strict ESNext compiler options and eager model sync", () => {
    const monacoStub = createMonacoStub();

    configureTypeScriptWorker(monacoStub);

    const compilerOptions = monacoStub.typescript.typescriptDefaults.getCompilerOptions();
    expect(compilerOptions.strict).toBe(true);
    expect(compilerOptions.target).toBe(monacoStub.typescript.ScriptTarget.ESNext);
    expect(compilerOptions.module).toBe(monacoStub.typescript.ModuleKind.ESNext);
    expect(compilerOptions.lib).toEqual(["ESNext", "DOM", "DOM.Iterable"]);
    expect(compilerOptions.exactOptionalPropertyTypes).toBe(true);
    expect(compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(compilerOptions.allowImportingTsExtensions).toBe(true);
    expect(compilerOptions.verbatimModuleSyntax).toBe(true);
    expect(monacoStub.typescript.typescriptDefaults.getEagerModelSync()).toBe(true);
  });
});
