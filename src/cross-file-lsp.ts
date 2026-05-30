import type * as monaco from "monaco-editor";
import type { MaldivesWorkspace } from "./workspace";

type MonacoApi = typeof monaco;
type WorkspaceModel = monaco.editor.ITextModel;
type WorkspaceLike = Pick<MaldivesWorkspace, "uris" | "model" | "switchTo">;
type TypeScriptWorkerFactory = (uri: monaco.Uri) => Promise<TypeScriptWorker>;
type TypeScriptLanguageApi = { getTypeScriptWorker?: () => Promise<TypeScriptWorkerFactory> };

type TypeScriptWorker = {
  getDefinitionAtPosition(fileName: string, position: number): Promise<ReadonlyArray<DefinitionInfo> | undefined>;
};

export interface DefinitionInfo {
  readonly fileName: string;
  readonly textSpan: { readonly start: number; readonly length: number };
}

export interface DefinitionTarget {
  readonly uri: string;
  readonly model: WorkspaceModel;
  readonly offset: number;
}

export interface WorkspaceTypeScriptMirror {
  sync(): void;
  dispose(): void;
}

export interface CrossFileLspController {
  syncWorkspaceModels(): void;
  goToDefinition(): Promise<CrossFileLspResult>;
}

export type CrossFileLspResult =
  | { readonly ok: true; readonly uri: string; readonly lineNumber: number; readonly column: number }
  | { readonly ok: false; readonly reason: "missing-model" | "missing-position" | "missing-worker" | "no-definition" };

export function createWorkspaceTypeScriptMirror(monacoApi: MonacoApi, workspace: Pick<MaldivesWorkspace, "uris" | "model">): WorkspaceTypeScriptMirror {
  let disposables: monaco.IDisposable[] = [];

  return {
    sync() {
      for (const disposable of disposables) {
        disposable.dispose();
      }

      disposables = [];

      for (const uri of workspace.uris()) {
        const model = workspace.model(uri);

        if (model && isTypeScriptLikeUri(model.uri.toString())) {
          disposables.push(monacoApi.typescript.typescriptDefaults.addExtraLib(model.getValue(), model.uri.toString()));
        }
      }
    },
    dispose() {
      for (const disposable of disposables) {
        disposable.dispose();
      }

      disposables = [];
    },
  };
}

export function definitionTargetFor(definitions: ReadonlyArray<DefinitionInfo> | undefined, workspace: Pick<MaldivesWorkspace, "model">): DefinitionTarget | undefined {
  for (const definition of definitions ?? []) {
    const model = workspace.model(definition.fileName);

    if (model) {
      return { uri: definition.fileName, model, offset: definition.textSpan.start };
    }
  }

  return undefined;
}

export function installCrossFileLspController(options: {
  readonly monaco: MonacoApi;
  readonly editor: monaco.editor.IStandaloneCodeEditor;
  readonly workspace: WorkspaceLike;
}): CrossFileLspController {
  const mirror = createWorkspaceTypeScriptMirror(options.monaco, options.workspace);

  return {
    syncWorkspaceModels() {
      mirror.sync();
    },
    async goToDefinition() {
      return goToWorkspaceDefinition({ ...options, mirror });
    },
  };
}

async function goToWorkspaceDefinition(options: {
  readonly monaco: MonacoApi;
  readonly editor: monaco.editor.IStandaloneCodeEditor;
  readonly workspace: WorkspaceLike;
  readonly mirror: WorkspaceTypeScriptMirror;
}): Promise<CrossFileLspResult> {
  const model = options.editor.getModel();
  const position = options.editor.getPosition();

  if (!model) {
    return { ok: false, reason: "missing-model" };
  }

  if (!position) {
    return { ok: false, reason: "missing-position" };
  }

  options.mirror.sync();
  const getTypeScriptWorker = (options.monaco.languages.typescript as unknown as TypeScriptLanguageApi).getTypeScriptWorker;

  if (!getTypeScriptWorker) {
    return { ok: false, reason: "missing-worker" };
  }

  const getWorker = await getTypeScriptWorker();
  const worker = await getWorker(model.uri);
  const definitions = await worker.getDefinitionAtPosition(model.uri.toString(), model.getOffsetAt(position));
  const target = definitionTargetFor(definitions, options.workspace);

  if (!target) {
    return { ok: false, reason: "no-definition" };
  }

  options.workspace.switchTo(target.uri);
  options.editor.setModel(target.model);
  const targetPosition = target.model.getPositionAt(target.offset);
  options.editor.setPosition(targetPosition);
  options.editor.revealLineInCenter(targetPosition.lineNumber);
  options.editor.focus();

  return {
    ok: true,
    uri: target.uri,
    lineNumber: targetPosition.lineNumber,
    column: targetPosition.column,
  };
}

function isTypeScriptLikeUri(uri: string): boolean {
  return /\.[cm]?[tj]sx?(?:$|[?#])/.test(uri);
}
