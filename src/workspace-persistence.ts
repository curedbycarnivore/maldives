import type { editor } from "monaco-editor";
import type { MaldivesWorkspace, WorkspaceCursor } from "./workspace";

export const WORKSPACE_PERSISTENCE_KEY = "maldives.workspace.v1";

export interface WorkspacePersistenceFile {
  readonly uri: string;
  readonly content: string;
  readonly cursor?: WorkspaceCursor;
}

export interface WorkspacePersistenceSnapshot {
  readonly version: 1;
  readonly activeUri?: string;
  readonly files: WorkspacePersistenceFile[];
}

export interface WorkspacePersistenceEditor {
  getPosition?(): WorkspaceCursor | null;
  setPosition?(position: WorkspaceCursor): void;
  onDidChangeCursorPosition?(listener: () => void): { dispose(): void };
}

export function captureWorkspaceSnapshot(
  workspace: Pick<MaldivesWorkspace, "uris" | "activeUri" | "model" | "cursor" | "setCursor">,
  editor: WorkspacePersistenceEditor,
): WorkspacePersistenceSnapshot {
  return {
    version: 1,
    activeUri: workspace.activeUri,
    files: workspace.uris().flatMap((uri) => {
      const model = workspace.model(uri);

      if (!model) {
        return [];
      }

      return [{ uri, content: model.getValue(), cursor: workspace.cursor(uri) }];
    }),
  };
}

export function restoreWorkspaceSnapshot(
  workspace: Pick<MaldivesWorkspace, "open" | "switchTo" | "setCursor">,
  snapshot: WorkspacePersistenceSnapshot | undefined,
): boolean {
  if (!snapshot || snapshot.version !== 1 || snapshot.files.length === 0) {
    return false;
  }

  for (const file of snapshot.files) {
    workspace.open(file.uri, file.content);
    workspace.setCursor(file.uri, file.cursor);
  }

  workspace.switchTo(snapshot.activeUri ?? snapshot.files[0]?.uri ?? "");
  return true;
}

export function readWorkspaceSnapshot(storage: Pick<Storage, "getItem">, key = WORKSPACE_PERSISTENCE_KEY): WorkspacePersistenceSnapshot | undefined {
  const raw = storage.getItem(key);

  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as WorkspacePersistenceSnapshot;

    if (parsed.version === 1 && Array.isArray(parsed.files)) {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function restoreWorkspaceFromStorage(
  workspace: Pick<MaldivesWorkspace, "open" | "switchTo" | "setCursor">,
  storage: Pick<Storage, "getItem">,
  key = WORKSPACE_PERSISTENCE_KEY,
): boolean {
  return restoreWorkspaceSnapshot(workspace, readWorkspaceSnapshot(storage, key));
}

export function installWorkspacePersistence(options: {
  readonly workspace: Pick<MaldivesWorkspace, "uris" | "activeUri" | "model" | "cursor" | "setCursor" | "onDidChange">;
  readonly editor: WorkspacePersistenceEditor;
  readonly storage: Pick<Storage, "setItem">;
  readonly key?: string;
}): { dispose(): void } {
  const key = options.key ?? WORKSPACE_PERSISTENCE_KEY;
  const persist = () => {
    options.storage.setItem(key, JSON.stringify(captureWorkspaceSnapshot(options.workspace, options.editor)));
  };
  const persistCursor = () => {
    const position = options.editor.getPosition?.();

    if (options.workspace.activeUri && position) {
      options.workspace.setCursor(options.workspace.activeUri, position);
    }

    persist();
  };
  const workspaceSubscription = options.workspace.onDidChange(persist);
  const cursorSubscription = options.editor.onDidChangeCursorPosition?.(persistCursor);

  persist();

  return {
    dispose() {
      workspaceSubscription.dispose();
      cursorSubscription?.dispose();
    },
  };
}

export type WorkspacePersistenceModel = editor.ITextModel;
