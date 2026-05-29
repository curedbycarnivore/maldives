import type * as monaco from "monaco-editor";
import extensionHostWorkerUrl from "/node_modules/@codingame/monaco-vscode-api/workers/extensionHost.worker.js?url";
import { auditEffectDtsExports, EFFECT_TYPE_STUB, type EffectDtsFiles, type EffectPackageExports } from "./typescript-worker";

type MonacoApi = typeof monaco;

type WrapperLike = {
  start(instructions?: { caller?: string; performServiceConsistencyChecks?: boolean }): Promise<void>;
};

type TypeScriptExtensionModule = {
  whenReady?: () => Promise<void>;
};

export interface VscodeTypeScriptWorkerDeps {
  createWrapper: (config: unknown) => WrapperLike;
  loadTypeScriptExtension: () => Promise<TypeScriptExtensionModule>;
  initFile: (path: string, content: string) => Promise<void>;
}

export interface VscodeTypeScriptOverlayOptions {
  effectDtsFiles?: EffectDtsFiles;
  packageExports?: EffectPackageExports;
}

export interface VscodeTypeScriptOverlay {
  files: Map<string, string>;
}

export interface StartVscodeTypeScriptWorkerOptions extends VscodeTypeScriptOverlayOptions {
  deps?: VscodeTypeScriptWorkerDeps;
}

export interface VscodeTypeScriptWorkerBootstrap {
  overlayFiles: string[];
  stockDiagnosticsDisabled: boolean;
}

let bootstrapPromise: Promise<VscodeTypeScriptWorkerBootstrap> | undefined;

const effectDtsMarker = "effect/dist/dts/";

export function buildVscodeTypeScriptOverlay(options: VscodeTypeScriptOverlayOptions = {}): VscodeTypeScriptOverlay {
  const files = new Map<string, string>();
  const effectDtsFiles = options.effectDtsFiles ?? {};
  const coverage = auditEffectDtsExports(effectDtsFiles, { packageExports: options.packageExports });

  for (const [path, content] of Object.entries(effectDtsFiles)) {
    const virtualPath = effectDtsVirtualPath(path);

    if (virtualPath) {
      files.set(virtualPath, content);
    }
  }

  if (!files.has("file:///node_modules/effect/index.d.ts")) {
    files.set("file:///node_modules/effect/index.d.ts", EFFECT_TYPE_STUB);
  }

  files.set("file:///node_modules/effect/package.json", effectPackageJson(coverage.exportVirtualPaths));
  files.set("file:///workspace/tsconfig.json", vscodeTsConfigJson());

  return { files };
}

export async function startVscodeTypeScriptWorkerForMaldives(
  monacoApi: MonacoApi,
  options: StartVscodeTypeScriptWorkerOptions = {},
): Promise<VscodeTypeScriptWorkerBootstrap> {
  bootstrapPromise ??= bootVscodeTypeScriptWorker(monacoApi, options);
  return bootstrapPromise;
}

async function bootVscodeTypeScriptWorker(
  monacoApi: MonacoApi,
  options: StartVscodeTypeScriptWorkerOptions,
): Promise<VscodeTypeScriptWorkerBootstrap> {
  const deps = options.deps ?? defaultDeps(monacoApi);
  const overlay = buildVscodeTypeScriptOverlay(options);

  for (const [path, content] of overlay.files) {
    await deps.initFile(path, content);
  }

  const extension = await deps.loadTypeScriptExtension();
  const wrapper = deps.createWrapper(vscodeApiConfig());
  await wrapper.start({ caller: "maldives-p11b-vscode-ts-worker", performServiceConsistencyChecks: false });
  await extension.whenReady?.();
  disableStockTypeScriptSemanticDiagnostics(monacoApi);

  return {
    overlayFiles: [...overlay.files.keys()].sort(),
    stockDiagnosticsDisabled: true,
  };
}

function defaultDeps(monacoApi: MonacoApi): VscodeTypeScriptWorkerDeps {
  return {
    createWrapper(config) {
      const lazyWrapper: WrapperLike = {
        async start(instructions) {
          const { MonacoVscodeApiWrapper } = await import("monaco-languageclient/vscodeApiWrapper");
          const wrapper = new MonacoVscodeApiWrapper(config as ConstructorParameters<typeof MonacoVscodeApiWrapper>[0]);
          await wrapper.start(instructions);
        },
      };
      return lazyWrapper;
    },
    async loadTypeScriptExtension() {
      return import("@codingame/monaco-vscode-typescript-language-features-default-extension") as Promise<TypeScriptExtensionModule>;
    },
    async initFile(path, content) {
      const { initFile } = await import("@codingame/monaco-vscode-files-service-override");
      await initFile(monacoApi.Uri.parse(path) as never, content);
    },
  };
}

function vscodeApiConfig(): unknown {
  return {
    $type: "classic",
    monacoWorkerFactory: configureVscodeWorkerUrls,
    viewsConfig: { $type: "EditorService" },
    userConfiguration: {
      json: JSON.stringify({
        "typescript.validate.enable": true,
        "javascript.validate.enable": true,
        "typescript.tsserver.web.projectWideIntellisense.enabled": true,
        "typescript.inlayHints.parameterNames.enabled": "all",
        "typescript.inlayHints.parameterNames.suppressWhenArgumentMatchesName": false,
        "typescript.inlayHints.parameterTypes.enabled": true,
        "typescript.inlayHints.variableTypes.enabled": true,
        "typescript.inlayHints.propertyDeclarationTypes.enabled": true,
        "typescript.inlayHints.functionLikeReturnTypes.enabled": true,
        "typescript.inlayHints.enumMemberValues.enabled": true,
      }),
    },
    advanced: {
      enableExtHostWorker: true,
      loadExtensionServices: true,
      loadThemes: false,
      enforceSemanticHighlighting: true,
    },
  };
}

function configureVscodeWorkerUrls(): void {
  const environment = (globalThis.MonacoEnvironment ?? {}) as typeof globalThis.MonacoEnvironment & {
    getWorkerUrl?: (workerId: string, label: string) => string | undefined;
    getWorkerOptions?: (moduleId: string, label: string) => WorkerOptions | undefined;
  };
  const previousGetWorkerUrl = environment.getWorkerUrl;
  const previousGetWorkerOptions = environment.getWorkerOptions;

  environment.getWorkerUrl = (workerId, label) =>
    label === "extensionHostWorkerMain" ? extensionHostWorkerUrl : (previousGetWorkerUrl?.(workerId, label) ?? "");
  environment.getWorkerOptions = (moduleId, label) =>
    label === "extensionHostWorkerMain" ? { type: "module" } : previousGetWorkerOptions?.(moduleId, label);
  globalThis.MonacoEnvironment = environment;
}

function disableStockTypeScriptSemanticDiagnostics(monacoApi: MonacoApi): void {
  const typeScriptDefaults = (monacoApi.languages.typescript as unknown as {
    typescriptDefaults: {
      setDiagnosticsOptions(options: unknown): void;
    };
  }).typescriptDefaults;

  typeScriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  });
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

function effectPackageJson(exportVirtualPaths: string[]): string {
  const exportsMap: Record<string, { types: string }> = {};

  for (const virtualPath of exportVirtualPaths) {
    const fileName = virtualPath.replace("file:///node_modules/effect/", "");
    const exportName = fileName === "index.d.ts" ? "." : `./${fileName.replace(/\.d\.ts$/, "")}`;
    exportsMap[exportName] = { types: `./${fileName}` };
  }

  return JSON.stringify({ name: "effect", types: "./index.d.ts", exports: exportsMap }, null, 2);
}

function vscodeTsConfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        exactOptionalPropertyTypes: true,
        noUncheckedIndexedAccess: true,
        jsx: "react-jsx",
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        allowNonTsExtensions: true,
        lib: ["ESNext", "DOM", "DOM.Iterable"],
      },
    },
    null,
    2,
  );
}
