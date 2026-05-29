import type * as monaco from "monaco-editor";
import * as ts from "typescript";
import effectLanguageServiceInit from "@effect/language-service";
import { effectLanguageServicePluginConfig } from "./effect-language-service-config";

export { effectLanguageServicePluginConfig };

type MonacoApi = typeof monaco;
type EffectLanguageServiceInit = (modules: { typescript: typeof ts }) => {
  create(info: {
    languageService: ts.LanguageService;
    config: typeof effectLanguageServicePluginConfig;
    project: { log(message: string): void };
    languageServiceHost: ts.LanguageServiceHost;
  }): ts.LanguageService;
};

export interface EffectLanguageServiceSnapshotOptions {
  path: string;
  source: string;
  effectDtsFiles?: Record<string, string>;
  typeScriptLibFiles?: Record<string, string>;
  refactorRange?: { pos: number; end: number };
}

export interface EffectLanguageServiceDiagnostic {
  code: number;
  rule: string;
  message: string;
  start: number;
  length: number;
  category: string;
}

export interface EffectLanguageServiceRefactor {
  name: string;
  description: string;
  actions: string[];
}

export interface EffectLanguageServiceRenderedDiagnostic {
  rule: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  message: string;
}

export interface EffectLanguageServiceSnapshot {
  diagnostics: EffectLanguageServiceDiagnostic[];
  refactors: EffectLanguageServiceRefactor[];
}

export interface EffectLanguageServiceController {
  refreshModel(model: monaco.editor.ITextModel): Promise<void>;
  getDiagnostics(model: monaco.editor.ITextModel): EffectLanguageServiceDiagnostic[];
  getRenderedDiagnostics(model: monaco.editor.ITextModel): EffectLanguageServiceRenderedDiagnostic[];
  getRefactors(model: monaco.editor.ITextModel, range: { pos: number; end: number }): EffectLanguageServiceRefactor[];
  dispose(): void;
}

const markerOwner = "effect-language-service";
const effectDtsMarker = "effect/dist/dts/";
const effectVirtualPrefix = "/node_modules/effect/";

export function createEffectLanguageServiceSnapshot(options: EffectLanguageServiceSnapshotOptions): EffectLanguageServiceSnapshot {
  const sourcePath = normalizeModelPath(options.path);
  const hostFiles = buildHostFiles(options);
  hostFiles.set(sourcePath, options.source);

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    noEmit: true,
    skipLibCheck: true,
  };
  const host = createHost(sourcePath, hostFiles, compilerOptions);
  const languageService = ts.createLanguageService(host);
  const plugin = (effectLanguageServiceInit as EffectLanguageServiceInit)({ typescript: ts });
  const effectLanguageService = plugin.create({
    languageService,
    config: effectLanguageServicePluginConfig,
    project: { log: () => undefined },
    languageServiceHost: host,
  });

  const diagnostics = effectLanguageService.getSemanticDiagnostics(sourcePath).map((diagnostic) => toDiagnostic(diagnostic));
  const refactorRange = options.refactorRange ?? asyncFunctionRange(options.source);
  const refactors = refactorRange
    ? effectLanguageService.getApplicableRefactors(sourcePath, refactorRange, {}, undefined).map(toRefactor)
    : [];

  languageService.dispose();
  return { diagnostics, refactors };
}

export function installEffectLanguageService(
  monacoApi: MonacoApi,
  editor: monaco.editor.IStandaloneCodeEditor,
  options: Pick<EffectLanguageServiceSnapshotOptions, "effectDtsFiles" | "typeScriptLibFiles">,
): EffectLanguageServiceController {
  const diagnosticsByUri = new Map<string, EffectLanguageServiceDiagnostic[]>();
  const disposables: monaco.IDisposable[] = [];
  let refreshTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const refreshModel = async (model: monaco.editor.ITextModel): Promise<void> => {
    const snapshot = createEffectLanguageServiceSnapshot({
      path: model.uri.toString(),
      source: model.getValue(),
      ...options,
    });
    diagnosticsByUri.set(model.uri.toString(), snapshot.diagnostics);
    monacoApi.editor.setModelMarkers(model, markerOwner, snapshot.diagnostics.map((diagnostic) => toMarker(monacoApi, model, diagnostic)));
  };

  const scheduleRefresh = (model: monaco.editor.ITextModel | null) => {
    if (!model) {
      return;
    }
    if (refreshTimer) {
      globalThis.clearTimeout(refreshTimer);
    }
    refreshTimer = globalThis.setTimeout(() => void refreshModel(model), 250);
  };

  disposables.push(editor.onDidChangeModel(() => scheduleRefresh(editor.getModel())));
  disposables.push(editor.onDidChangeModelContent(() => scheduleRefresh(editor.getModel())));
  disposables.push(
    monacoApi.languages.registerCodeActionProvider(["typescript", "javascript"], {
      provideCodeActions(model, range) {
        if (!model.getValue().includes("from \"effect\"") && !model.getValue().includes("from 'effect'")) {
          return { actions: [], dispose: () => undefined };
        }

        const start = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
        const end = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
        const refactors = createEffectLanguageServiceSnapshot({
          path: model.uri.toString(),
          source: model.getValue(),
          ...options,
          refactorRange: { pos: start, end },
        }).refactors;

        return {
          actions: refactors.flatMap((refactor) =>
            refactor.actions.map((title) => ({
              title,
              kind: "refactor.rewrite",
              command: { id: "editor.action.quickCommand", title },
            })),
          ),
          dispose: () => undefined,
        };
      },
    }, { providedCodeActionKinds: ["refactor.rewrite"] }),
  );

  const currentModel = editor.getModel();
  if (currentModel) {
    void refreshModel(currentModel);
  }

  return {
    refreshModel,
    getDiagnostics(model) {
      return diagnosticsByUri.get(model.uri.toString()) ?? [];
    },
    getRenderedDiagnostics(model) {
      return monacoApi.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.source === "@effect/language-service")
        .map((marker) => ({
          rule: ruleFromMessage(marker.message),
          startLine: marker.startLineNumber,
          startCol: marker.startColumn,
          endLine: marker.endLineNumber,
          endCol: marker.endColumn,
          message: marker.message,
        }))
        .sort(compareRenderedDiagnostics);
    },
    getRefactors(model, range) {
      return createEffectLanguageServiceSnapshot({
        path: model.uri.toString(),
        source: model.getValue(),
        ...options,
        refactorRange: range,
      }).refactors;
    },
    dispose() {
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
      }
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
}

function createHost(fileName: string, files: Map<string, string>, compilerOptions: ts.CompilerOptions): ts.LanguageServiceHost {
  return {
    getScriptFileNames: () => [fileName],
    getScriptVersion: () => "1",
    getScriptSnapshot: (path) => {
      const text = readHostFile(files, path);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => "/workspace",
    getCompilationSettings: () => compilerOptions,
    getDefaultLibFileName: () => "/node_modules/typescript/lib/lib.esnext.full.d.ts",
    fileExists: (path) => readHostFile(files, path) !== undefined,
    readFile: (path) => readHostFile(files, path),
    readDirectory: () => [],
    directoryExists: () => true,
    getDirectories: () => [],
    useCaseSensitiveFileNames: () => true,
    resolveModuleNames: (moduleNames, containingFile) => moduleNames.map((moduleName) => resolveModule(files, moduleName, containingFile)),
  };
}

function buildHostFiles(options: EffectLanguageServiceSnapshotOptions): Map<string, string> {
  const files = new Map<string, string>();

  for (const [path, contents] of Object.entries(options.effectDtsFiles ?? {})) {
    const virtualPath = effectDtsVirtualPath(path);
    if (virtualPath) {
      files.set(virtualPath, contents);
    }
  }

  if (!files.has("/node_modules/effect/index.d.ts")) {
    const index = readFromTsSys("node_modules/effect/dist/dts/index.d.ts");
    if (index) {
      files.set("/node_modules/effect/index.d.ts", index);
    }
  }

  for (const [path, contents] of Object.entries(options.typeScriptLibFiles ?? {})) {
    files.set(normalizeModelPath(path), contents);
  }

  return files;
}

function readHostFile(files: Map<string, string>, path: string): string | undefined {
  const normalized = normalizeModelPath(path);
  const direct = files.get(normalized);
  if (direct !== undefined) {
    return direct;
  }

  const basename = normalized.split("/").pop();
  if (basename?.startsWith("lib.") && basename.endsWith(".d.ts")) {
    const libEntry = [...files.entries()].find(([filePath]) => filePath.endsWith(`/${basename}`));
    if (libEntry) {
      return libEntry[1];
    }
  }

  if (normalized.startsWith(effectVirtualPrefix)) {
    return files.get(normalized) ?? readFromTsSys(`node_modules/effect/dist/dts/${normalized.slice(effectVirtualPrefix.length)}`);
  }

  return readFromTsSys(normalized.replace(/^\//, ""));
}

function resolveModule(files: Map<string, string>, moduleName: string, containingFile: string): ts.ResolvedModule | undefined {
  const candidates = moduleCandidates(moduleName, normalizeModelPath(containingFile));
  const resolvedFileName = candidates.find((candidate) => readHostFile(files, candidate) !== undefined);

  return resolvedFileName ? ({ resolvedFileName, extension: ts.Extension.Dts } as unknown as ts.ResolvedModule) : undefined;
}

function moduleCandidates(moduleName: string, containingFile: string): string[] {
  if (moduleName === "effect") {
    return ["/node_modules/effect/index.d.ts"];
  }

  if (moduleName.startsWith("effect/")) {
    return [`/node_modules/effect/${moduleName.slice("effect/".length)}.d.ts`];
  }

  if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
    const base = containingFile.slice(0, containingFile.lastIndexOf("/") + 1);
    const withoutJs = moduleName.replace(/\.js$/, "");
    return [normalizePathSegments(`${base}${withoutJs}.d.ts`), normalizePathSegments(`${base}${moduleName}`)];
  }

  return [];
}

function effectDtsVirtualPath(path: string): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const markerIndex = normalized.indexOf(effectDtsMarker);

  if (markerIndex === -1 || !normalized.endsWith(".d.ts")) {
    return undefined;
  }

  return `${effectVirtualPrefix}${normalized.slice(markerIndex + effectDtsMarker.length)}`;
}

function normalizeModelPath(path: string): string {
  return normalizePathSegments(path.replace(/^file:\/\//, "").replace(/^\/node_modules\//, "/node_modules/"));
}

function normalizePathSegments(path: string): string {
  const prefix = path.startsWith("/") ? "/" : "";
  const parts: string[] = [];

  for (const part of path.split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return `${prefix}${parts.join("/")}`;
}

function toDiagnostic(diagnostic: ts.Diagnostic): EffectLanguageServiceDiagnostic {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  return {
    code: Number(diagnostic.code),
    rule: ruleFromMessage(message),
    message,
    start: diagnostic.start ?? 0,
    length: diagnostic.length ?? 1,
    category: ts.DiagnosticCategory[diagnostic.category] ?? "Unknown",
  };
}

function ruleFromMessage(message: string): string {
  return /effect\(([^)]+)\)/.exec(message)?.[1] ?? "typescript";
}

function compareRenderedDiagnostics(left: EffectLanguageServiceRenderedDiagnostic, right: EffectLanguageServiceRenderedDiagnostic): number {
  return (
    left.startLine - right.startLine ||
    left.startCol - right.startCol ||
    left.endLine - right.endLine ||
    left.endCol - right.endCol ||
    left.rule.localeCompare(right.rule) ||
    left.message.localeCompare(right.message)
  );
}

function toRefactor(refactor: ts.ApplicableRefactorInfo): EffectLanguageServiceRefactor {
  return {
    name: refactor.name,
    description: refactor.description,
    actions: refactor.actions.map((action) => action.description || action.name),
  };
}

function toMarker(
  monacoApi: MonacoApi,
  model: monaco.editor.ITextModel,
  diagnostic: EffectLanguageServiceDiagnostic,
): monaco.editor.IMarkerData {
  const start = model.getPositionAt(diagnostic.start);
  const end = model.getPositionAt(diagnostic.start + diagnostic.length);

  return {
    severity: diagnostic.category === "Error" ? monacoApi.MarkerSeverity.Error : monacoApi.MarkerSeverity.Warning,
    message: diagnostic.message,
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
    code: String(diagnostic.code),
    source: "@effect/language-service",
  };
}

function asyncFunctionRange(source: string): { pos: number; end: number } | undefined {
  const pos = source.indexOf("async function");
  if (pos === -1) {
    return undefined;
  }

  return { pos, end: source.indexOf("\n}", pos) + 2 || pos };
}

function readFromTsSys(path: string): string | undefined {
  return typeof ts.sys?.readFile === "function" ? ts.sys.readFile(path) : undefined;
}
