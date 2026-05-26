import type * as monaco from "monaco-editor";

type MonacoApi = typeof monaco;
type MonacoCompilerOptions = monaco.typescript.CompilerOptions;
type StrictCompilerOptions = MonacoCompilerOptions & {
  exactOptionalPropertyTypes: true;
  noUncheckedIndexedAccess: true;
  allowImportingTsExtensions: true;
  verbatimModuleSyntax: true;
};

const bundlerModuleResolution = 100 as MonacoCompilerOptions["moduleResolution"];

export function configureTypeScriptWorker(monacoApi: MonacoApi): void {
  const { typescript } = monacoApi;

  const compilerOptions: StrictCompilerOptions = {
    target: typescript.ScriptTarget.ESNext,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: bundlerModuleResolution,
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    lib: ["ESNext", "DOM", "DOM.Iterable"],
    jsx: typescript.JsxEmit.ReactJSX,
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    allowNonTsExtensions: true,
  };

  typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: false,
  });
  typescript.typescriptDefaults.setInlayHintsOptions({
    includeInlayParameterNameHints: "all",
    includeInlayParameterNameHintsWhenArgumentMatchesName: false,
    includeInlayFunctionParameterTypeHints: true,
    includeInlayVariableTypeHints: true,
    includeInlayPropertyDeclarationTypeHints: true,
    includeInlayFunctionLikeReturnTypeHints: true,
    includeInlayEnumMemberValueHints: true,
  });
  typescript.typescriptDefaults.setEagerModelSync(true);
}
