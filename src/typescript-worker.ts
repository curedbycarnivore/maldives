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

export const EFFECT_TYPE_STUB = `
declare module "effect" {
  export const pipe: {
    <A>(a: A): A;
    <A, B>(a: A, ab: (a: A) => B): B;
    <A, B, C>(a: A, ab: (a: A) => B, bc: (b: B) => C): C;
    <A, B, C, D>(a: A, ab: (a: A) => B, bc: (b: B) => C, cd: (c: C) => D): D;
  };

  export namespace Effect {
    interface Effect<A, E = never, R = never> { readonly _A: A; readonly _E: E; readonly _R: R; }
    function succeed<A>(value: A): Effect<A>;
    function fail<E>(error: E): Effect<never, E>;
    function map<A, B>(f: (a: A) => B): <E, R>(self: Effect<A, E, R>) => Effect<B, E, R>;
    function flatMap<A, B, E2, R2>(f: (a: A) => Effect<B, E2, R2>): <E, R>(self: Effect<A, E, R>) => Effect<B, E | E2, R | R2>;
    function gen<Eff extends Effect<any, any, any>, A>(f: () => Generator<Eff, A, any>): Effect<A, unknown, unknown>;
  }

  export namespace Option {
    interface Some<A> { readonly _tag: "Some"; readonly value: A; }
    interface None { readonly _tag: "None"; }
    type Option<A> = Some<A> | None;
    function some<A>(value: A): Option<A>;
    const none: Option<never>;
    function map<A, B>(f: (a: A) => B): (self: Option<A>) => Option<B>;
  }

  export namespace Either {
    interface Right<R> { readonly _tag: "Right"; readonly right: R; }
    interface Left<L> { readonly _tag: "Left"; readonly left: L; }
    type Either<R, L> = Right<R> | Left<L>;
    function right<R>(r: R): Either<R, never>;
    function left<L>(l: L): Either<never, L>;
  }

  export namespace Schema {
    interface Schema<A, I = A, R = never> { readonly Type: A; readonly Encoded: I; readonly Context: R; }
    const String: Schema<string>;
    const Number: Schema<number>;
    function Struct<F extends Record<string, Schema<any>>>(fields: F): Schema<{ [K in keyof F]: F[K]["Type"] }>;
  }
}
`;

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
  typescript.typescriptDefaults.addExtraLib(
    EFFECT_TYPE_STUB,
    "file:///node_modules/@types/effect-stub/index.d.ts",
  );
}
