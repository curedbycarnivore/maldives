import type { editor } from "monaco-editor";
import { fsaPathForFileUri } from "./fs/fsa-adapter";
import type { FileSystemAdapter } from "./fs/types";
import type { MaldivesWorkspace, WorkspaceMode } from "./workspace";

type Monaco = typeof import("monaco-editor");

export const WRITE_MODE_CONTEXT_KEY = "maldivesWriteMode";
export const SAVE_ACTIVE_FILE_ACTION_ID = "maldives.saveActiveFile";

export interface SaveActiveWorkspaceFileOptions {
  readonly adapter: Pick<FileSystemAdapter, "writeFile">;
  readonly workspace: Pick<MaldivesWorkspace, "activeUri" | "mode" | "markClean">;
  readonly editor: Pick<editor.IStandaloneCodeEditor, "getValue">;
  readonly userGesture: boolean;
  readonly confirm?: () => boolean;
  readonly notify?: (message: string) => void;
}

export async function saveActiveWorkspaceFile(options: SaveActiveWorkspaceFileOptions): Promise<boolean> {
  const { adapter, workspace, editor, userGesture, notify } = options;

  if (workspace.mode !== "write") {
    notify?.("Switch to Write mode to edit");
    return false;
  }

  if (!workspace.activeUri) {
    notify?.("No file is open");
    return false;
  }

  if (options.confirm && !options.confirm()) {
    notify?.("Save cancelled");
    return false;
  }

  await adapter.writeFile(fsaPathForFileUri(workspace.activeUri), editor.getValue(), { userGesture });
  workspace.markClean(workspace.activeUri);
  notify?.("Saved");
  return true;
}

export interface InstallReadWriteToggleOptions {
  readonly monaco: Monaco;
  readonly editor: editor.IStandaloneCodeEditor;
  readonly workspace: MaldivesWorkspace;
  readonly adapter: Pick<FileSystemAdapter, "writeFile">;
  readonly confirm?: (message: string) => boolean;
}

export function installReadWriteToggle(container: HTMLElement, options: InstallReadWriteToggleOptions): void {
  if (container.querySelector(".maldives-readwrite-toggle")) {
    return;
  }

  const writeModeContext = options.editor.createContextKey?.(WRITE_MODE_CONTEXT_KEY, options.workspace.mode === "write");
  const status = document.createElement("div");
  status.className = "maldives-readwrite-status";
  status.setAttribute("role", "status");
  status.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:52px",
    "z-index:10001",
    "color:#d4d4d4",
    "font:12px system-ui,sans-serif",
  ].join(";");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "maldives-readwrite-toggle";
  button.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:10001",
    "background:#2d2d2d",
    "color:#fff",
    "border:1px solid #555",
    "border-radius:4px",
    "padding:8px 10px",
    "font:12px system-ui,sans-serif",
    "cursor:pointer",
  ].join(";");

  let pointerArmed = false;
  let saveConfirmed = false;
  const notify = (message: string) => {
    status.textContent = message;
  };
  const render = () => {
    const write = options.workspace.mode === "write";
    button.textContent = write ? "🔓 Write" : "🔒 Read-only";
    button.setAttribute("aria-pressed", String(write));
    writeModeContext?.set(write);
    notify(write ? "Write mode: edits and save enabled" : "Read-only mode: edits blocked");
  };

  button.addEventListener("pointerdown", () => {
    pointerArmed = true;
  });
  button.addEventListener("click", () => {
    if (!pointerArmed) {
      return;
    }

    pointerArmed = false;
    options.workspace.toggleMode();
    render();
    refreshEditorModelForWriteMode(options.editor, options.workspace.mode);
  });

  options.editor.addAction({
    id: SAVE_ACTIVE_FILE_ACTION_ID,
    label: "Save Active File",
    keybindings: [options.monaco.KeyMod.CtrlCmd | options.monaco.KeyCode.KeyS],
    run: async () => {
      await saveActiveWorkspaceFile({
        adapter: options.adapter,
        workspace: options.workspace,
        editor: options.editor,
        userGesture: true,
        notify,
        confirm: saveConfirmed
          ? undefined
          : () => {
              const confirmed = (options.confirm ?? globalThis.confirm)("Save changes to disk?");
              saveConfirmed = confirmed;
              return confirmed;
            },
      });
    },
  });

  container.append(status, button);
  render();
}

function refreshEditorModelForWriteMode(editor: editor.IStandaloneCodeEditor, mode: WorkspaceMode): void {
  if (mode !== "write") {
    return;
  }

  const model = editor.getModel();

  if (!model) {
    return;
  }

  const viewState = editor.saveViewState();
  editor.setModel(null);
  editor.setModel(model);

  if (viewState) {
    editor.restoreViewState(viewState);
  }

  editor.focus();
}

export function workspaceModeLabel(mode: WorkspaceMode): string {
  return mode === "write" ? "Write" : "Read-only";
}
