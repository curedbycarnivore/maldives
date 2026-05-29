import type * as monaco from "monaco-editor";

type MonacoApi = typeof monaco;
type MonacoCompilerOptions = monaco.typescript.CompilerOptions;
type TypeScriptWorkerClient = {
  getNavigationTree(fileName: string): Promise<unknown>;
};
type TypeScriptWorkerFactory = (uri: monaco.Uri) => Promise<TypeScriptWorkerClient>;
type TypeScriptLanguageApi = {
  getTypeScriptWorker(): Promise<TypeScriptWorkerFactory>;
};
type StrictCompilerOptions = MonacoCompilerOptions & {
  exactOptionalPropertyTypes: true;
  noUncheckedIndexedAccess: true;
  allowImportingTsExtensions: true;
  verbatimModuleSyntax: true;
};

const bundlerModuleResolution = 100 as MonacoCompilerOptions["moduleResolution"];
const effectDtsMarker = "effect/dist/dts/";

export type EffectDtsFiles = Record<string, string>;
export type EffectPackageExports = Record<string, unknown>;

export interface RegisterEffectDtsFilesOptions {
  packageExports?: EffectPackageExports;
}

export interface EffectDtsCoverage {
  registeredDtsVirtualPaths: string[];
  syntheticDtsVirtualPaths: string[];
  unmappedDtsFilePaths: string[];
  exportVirtualPaths: string[];
  missingExportVirtualPaths: string[];
}

export type EffectDtsRegistration = monaco.IDisposable & { coverage: EffectDtsCoverage };

export interface ConfigureTypeScriptWorkerOptions {
  effectDtsFiles?: EffectDtsFiles;
}

export interface WarmTypeScriptWorkerOptions {
  timeoutMs?: number;
}

let effectStubDisposable: monaco.IDisposable | undefined;

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

  export namespace Layer {
    interface Layer<ROut = never, E = never, RIn = never> { readonly _ROut: ROut; readonly _E: E; readonly _RIn: RIn; }
    function effect<Tag, A, E = never, R = never>(tag: Tag, effect: Effect.Effect<A, E, R>): Layer<Tag, E, R>;
  }

  export namespace Match {
    interface Matcher<A> { readonly value: A; }
    function value<A>(input: A): Matcher<A>;
    function when<A, B>(predicate: A, f: (value: A) => B): (self: Matcher<A>) => Matcher<A | B>;
    function orElse<A, B>(f: () => B): (self: Matcher<A>) => B;
  }

  export namespace Schedule {
    interface Schedule<Out = unknown, In = unknown, R = never> { readonly _Out: Out; readonly _In: In; readonly _R: R; }
    function exponential(duration: string): Schedule;
  }

  export namespace Stream {
    interface Stream<A, E = never, R = never> { readonly _A: A; readonly _E: E; readonly _R: R; }
    function fromIterable<A>(iterable: Iterable<A>): Stream<A>;
  }

  export namespace Fiber {
    interface RuntimeFiber<A = unknown, E = unknown> { readonly _A: A; readonly _E: E; }
    function interrupt<A, E>(fiber: RuntimeFiber<A, E>): Effect.Effect<void>;
  }
}
`;

export function registerEffectDtsFiles(
  monacoApi: MonacoApi,
  effectDtsFiles: EffectDtsFiles,
  options: RegisterEffectDtsFilesOptions = {},
): EffectDtsRegistration {
  effectStubDisposable?.dispose();
  effectStubDisposable = undefined;
  const coverage = auditEffectDtsExports(effectDtsFiles, options);
  const syntheticFiles = syntheticEffectDtsFiles(effectDtsFiles, coverage.syntheticDtsVirtualPaths);
  const filesToRegister = { ...effectDtsFiles, ...syntheticFiles };
  const disposables = Object.entries(filesToRegister)
    .map(([path, content]) => {
      const virtualPath = effectDtsVirtualPath(path);
      return virtualPath
        ? monacoApi.typescript.typescriptDefaults.addExtraLib(content, virtualPath)
        : undefined;
    })
    .filter((disposable): disposable is monaco.IDisposable => Boolean(disposable));

  if (options.packageExports) {
    disposables.push(
      monacoApi.typescript.typescriptDefaults.addExtraLib(
        effectPackageJsonForExports(coverage.exportVirtualPaths),
        "file:///node_modules/effect/package.json",
      ),
    );
  }

  return {
    coverage,
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
}

export function auditEffectDtsExports(
  effectDtsFiles: EffectDtsFiles,
  options: RegisterEffectDtsFilesOptions = {},
): EffectDtsCoverage {
  const mappedEntries = Object.keys(effectDtsFiles).map((path) => ({ path, virtualPath: effectDtsVirtualPath(path) }));
  const registeredDtsVirtualPaths = mappedEntries
    .map((entry) => entry.virtualPath)
    .filter((path): path is string => Boolean(path))
    .sort();
  const registeredSet = new Set(registeredDtsVirtualPaths);
  const unmappedDtsFilePaths = mappedEntries
    .filter((entry) => !entry.virtualPath)
    .map((entry) => entry.path)
    .sort();
  const exportVirtualPaths = options.packageExports
    ? effectExportVirtualPaths(options.packageExports).sort()
    : [];
  const syntheticDtsVirtualPaths = exportVirtualPaths
    .filter((path) => !registeredSet.has(path) && canSynthesizeEffectDts(path, registeredSet))
    .sort();
  const availableExportPaths = new Set([...registeredDtsVirtualPaths, ...syntheticDtsVirtualPaths]);
  const missingExportVirtualPaths = exportVirtualPaths
    .filter((path) => !availableExportPaths.has(path))
    .sort();

  return {
    registeredDtsVirtualPaths: [...registeredDtsVirtualPaths, ...syntheticDtsVirtualPaths].sort(),
    syntheticDtsVirtualPaths,
    unmappedDtsFilePaths,
    exportVirtualPaths,
    missingExportVirtualPaths,
  };
}

function effectDtsVirtualPath(path: string): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const markerIndex = normalized.indexOf(effectDtsMarker);

  if (markerIndex === -1 || !normalized.endsWith(".d.ts")) {
    return undefined;
  }

  const relativePath = normalized.slice(markerIndex + effectDtsMarker.length);
  return `file:///node_modules/effect/${relativePath}`;
}

function effectExportVirtualPaths(packageExports: EffectPackageExports): string[] {
  return Object.values(packageExports)
    .map((entry) => (isPackageExportWithTypes(entry) ? entry.types : undefined))
    .filter((typesPath): typesPath is string => Boolean(typesPath?.endsWith(".d.ts")))
    .map((typesPath) => effectDtsVirtualPath(`effect/${typesPath.replace(/^\.\//, "")}`))
    .filter((path): path is string => Boolean(path));
}

function isPackageExportWithTypes(entry: unknown): entry is { types: string } {
  return typeof entry === "object" && entry !== null && "types" in entry && typeof (entry as { types?: unknown }).types === "string";
}

function canSynthesizeEffectDts(virtualPath: string, registeredSet: Set<string>): boolean {
  return virtualPath === "file:///node_modules/effect/.index.d.ts" && registeredSet.has("file:///node_modules/effect/index.d.ts");
}

function syntheticEffectDtsFiles(effectDtsFiles: EffectDtsFiles, syntheticVirtualPaths: string[]): EffectDtsFiles {
  const indexEntry = Object.entries(effectDtsFiles).find(([path]) => effectDtsVirtualPath(path) === "file:///node_modules/effect/index.d.ts");
  if (!indexEntry) {
    return {};
  }

  const files: EffectDtsFiles = {};
  for (const virtualPath of syntheticVirtualPaths) {
    if (virtualPath === "file:///node_modules/effect/.index.d.ts") {
      files["/node_modules/effect/dist/dts/.index.d.ts"] = indexEntry[1];
    }
  }
  return files;
}

function effectPackageJsonForExports(exportVirtualPaths: string[]): string {
  const exportsMap: Record<string, { types: string }> = {};
  for (const virtualPath of exportVirtualPaths) {
    const fileName = virtualPath.replace("file:///node_modules/effect/", "");
    const exportName = fileName === "index.d.ts" ? "." : `./${fileName.replace(/\.d\.ts$/, "")}`;
    exportsMap[exportName] = { types: `./${fileName}` };
  }

  return JSON.stringify({ name: "effect", types: "./index.d.ts", exports: exportsMap }, null, 2);
}

export async function warmTypeScriptWorkerForModel(
  monacoApi: MonacoApi,
  model: monaco.editor.ITextModel,
  options: WarmTypeScriptWorkerOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const warmWorker = async () => {
    const typeScriptApi = monacoApi.languages.typescript as unknown as TypeScriptLanguageApi;
    const getWorker = await typeScriptApi.getTypeScriptWorker();
    const worker = await getWorker(model.uri);
    await worker.getNavigationTree(model.uri.toString());
  };

  await new Promise<void>((resolve) => {
    const timer = globalThis.setTimeout(resolve, timeoutMs);
    warmWorker().then(
      () => {
        globalThis.clearTimeout(timer);
        resolve();
      },
      () => {
        globalThis.clearTimeout(timer);
        resolve();
      },
    );
  });
}

export function configureTypeScriptWorker(monacoApi: MonacoApi, options: ConfigureTypeScriptWorkerOptions = {}): void {
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

  if (options.effectDtsFiles && Object.keys(options.effectDtsFiles).length > 0) {
    registerEffectDtsFiles(monacoApi, options.effectDtsFiles);
    return;
  }

  effectStubDisposable?.dispose();
  effectStubDisposable = typescript.typescriptDefaults.addExtraLib(
    EFFECT_TYPE_STUB,
    "file:///node_modules/@types/effect-stub/index.d.ts",
  );
}
