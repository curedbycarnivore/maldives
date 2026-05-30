import type * as monaco from "monaco-editor";

export type EffectTsgoSeverity = "error" | "warning";

export interface EffectTsgoDiagnosticMarker {
  readonly path: string;
  readonly severity: EffectTsgoSeverity;
  readonly code: string;
  readonly rule: string;
  readonly startLine: number;
  readonly startCol: number;
  readonly endLine: number;
  readonly endCol: number;
  readonly message: string;
}

export interface EffectTsgoBridgeResponse {
  readonly diagnostics: EffectTsgoDiagnosticMarker[];
}

export interface EffectTsgoRenderedDiagnostic {
  readonly rule: string;
  readonly startLine: number;
  readonly startCol: number;
  readonly endLine: number;
  readonly endCol: number;
  readonly message: string;
}

export interface EffectTsgoDiagnosticsClient {
  configure(options: { readonly endpoint: string; readonly debounceMs?: number }): void;
  refreshModel(model: Pick<monaco.editor.ITextModel, "uri" | "getValue">): Promise<void>;
  getRenderedDiagnostics(model: Pick<monaco.editor.ITextModel, "uri">): EffectTsgoRenderedDiagnostic[];
  dispose(): void;
}

type MonacoLike = {
  readonly MarkerSeverity: { readonly Error: number; readonly Warning: number };
  readonly editor: {
    setModelMarkers(model: any, owner: string, markers: unknown[]): void;
    getModelMarkers(filter: { resource: any }): Array<{
      source?: string;
      code?: string | { value: string };
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
      message: string;
    }>;
  };
};

const markerOwner = "effect-tsgo";

export function effectTsgoDiagnosticsToMarkers(
  diagnostics: readonly EffectTsgoDiagnosticMarker[],
  severity: { readonly error: number; readonly warning: number },
): monaco.editor.IMarkerData[] {
  return diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity === "warning" ? severity.warning : severity.error,
    code: diagnostic.rule,
    source: markerOwner,
    startLineNumber: diagnostic.startLine,
    startColumn: diagnostic.startCol,
    endLineNumber: diagnostic.endLine,
    endColumn: diagnostic.endCol,
    message: diagnostic.message,
  }));
}

export function createEffectTsgoDiagnosticsClient(options: {
  readonly monaco: MonacoLike;
  readonly fetch?: typeof fetch;
  readonly endpoint?: string;
}): EffectTsgoDiagnosticsClient {
  let endpoint = options.endpoint;
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  const refreshModel = async (model: Pick<monaco.editor.ITextModel, "uri" | "getValue">): Promise<void> => {
    if (!endpoint) {
      options.monaco.editor.setModelMarkers(model, markerOwner, []);
      return;
    }

    const path = pathFromUri(model.uri);
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, content: model.getValue() }),
    });

    if (!response.ok) {
      throw new Error(`Effect tsgo diagnostics bridge failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as EffectTsgoBridgeResponse;
    options.monaco.editor.setModelMarkers(
      model,
      markerOwner,
      effectTsgoDiagnosticsToMarkers(body.diagnostics, {
        error: options.monaco.MarkerSeverity.Error,
        warning: options.monaco.MarkerSeverity.Warning,
      }),
    );
  };

  return {
    configure(nextOptions) {
      endpoint = nextOptions.endpoint;
    },
    refreshModel,
    getRenderedDiagnostics(model) {
      return options.monaco.editor
        .getModelMarkers({ resource: model.uri })
        .filter((marker) => marker.source === markerOwner)
        .map((marker) => ({
          rule: markerRule(marker.code),
          startLine: marker.startLineNumber,
          startCol: marker.startColumn,
          endLine: marker.endLineNumber,
          endCol: marker.endColumn,
          message: marker.message,
        }))
        .sort(compareRenderedDiagnostics);
    },
    dispose() {
      endpoint = undefined;
    },
  };
}

export function installEffectTsgoDiagnosticsClient(
  monacoApi: typeof monaco,
  editor: monaco.editor.IStandaloneCodeEditor,
): EffectTsgoDiagnosticsClient {
  const client = createEffectTsgoDiagnosticsClient({ monaco: monacoApi });
  let refreshTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let debounceMs = 300;

  const scheduleRefresh = (model: monaco.editor.ITextModel | null) => {
    if (!model) return;
    if (refreshTimer) globalThis.clearTimeout(refreshTimer);
    refreshTimer = globalThis.setTimeout(() => void client.refreshModel(model), debounceMs);
  };

  const modelDisposable = editor.onDidChangeModel(() => scheduleRefresh(editor.getModel()));
  const contentDisposable = editor.onDidChangeModelContent(() => scheduleRefresh(editor.getModel()));

  return {
    configure(options) {
      debounceMs = options.debounceMs ?? debounceMs;
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
        refreshTimer = undefined;
      }
      client.configure(options);
    },
    async refreshModel(model) {
      if (refreshTimer) {
        globalThis.clearTimeout(refreshTimer);
        refreshTimer = undefined;
      }
      await client.refreshModel(model);
    },
    getRenderedDiagnostics: client.getRenderedDiagnostics,
    dispose() {
      if (refreshTimer) globalThis.clearTimeout(refreshTimer);
      modelDisposable.dispose();
      contentDisposable.dispose();
      client.dispose();
    },
  };
}

function pathFromUri(uri: Pick<monaco.Uri, "path" | "toString">): string {
  return uri.path || uri.toString().replace(/^file:\/\//, "");
}

function markerRule(code: string | { value: string } | undefined): string {
  if (typeof code === "string" && code.length > 0) return code;
  if (typeof code === "object" && typeof code.value === "string" && code.value.length > 0) return code.value;
  return "typescript";
}

function compareRenderedDiagnostics(left: EffectTsgoRenderedDiagnostic, right: EffectTsgoRenderedDiagnostic): number {
  return (
    left.startLine - right.startLine ||
    left.startCol - right.startCol ||
    left.endLine - right.endLine ||
    left.endCol - right.endCol ||
    left.rule.localeCompare(right.rule) ||
    left.message.localeCompare(right.message)
  );
}
