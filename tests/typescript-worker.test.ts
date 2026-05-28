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
});
