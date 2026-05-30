import type { editor } from "monaco-editor";

export type WorkspaceMode = "read" | "write";
export type WorkspaceSplitDirection = "root" | "right" | "down";

export interface WorkspacePane {
  readonly id: string;
  readonly uri: string;
  readonly direction: WorkspaceSplitDirection;
}

export interface WorkspaceCursor {
  lineNumber: number;
  column: number;
}

export interface MaldivesWorkspaceEditor {
  setModel(model: editor.ITextModel | null): void;
  saveViewState?(): unknown;
  restoreViewState?(state: unknown): void;
  getPosition?(): WorkspaceCursor | null;
  setPosition?(position: WorkspaceCursor): void;
  setSelection?(selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }): void;
  updateOptions?(options: { readOnly: boolean }): void;
  focus?(): void;
}

export interface MaldivesWorkspaceOptions {
  createModel(uri: string, content: string): editor.ITextModel;
  editor?: MaldivesWorkspaceEditor;
  initialMode?: WorkspaceMode;
}

export interface MaldivesWorkspaceSubscription {
  dispose(): void;
}

export type MaldivesWorkspaceListener = () => void;

interface WorkspaceEntry {
  model: editor.ITextModel;
  dirty: boolean;
  viewState?: unknown;
  cursor?: WorkspaceCursor;
  changeSubscription: { dispose: () => void };
}

export class MaldivesWorkspace {
  readonly #models = new Map<string, WorkspaceEntry>();
  readonly #createModel: MaldivesWorkspaceOptions["createModel"];
  readonly #editor?: MaldivesWorkspaceEditor;
  readonly #listeners = new Set<MaldivesWorkspaceListener>();
  readonly #panes: WorkspacePane[] = [];
  #activeUri: string | undefined;
  #activePaneId: string | undefined;
  #nextPaneNumber = 1;
  #mode: WorkspaceMode;

  constructor(options: MaldivesWorkspaceOptions) {
    this.#createModel = options.createModel;
    this.#editor = options.editor;
    this.#mode = options.initialMode ?? "read";
    this.#applyReadOnlyOption();
  }

  get activeUri(): string | undefined {
    return this.#activeUri;
  }

  get mode(): WorkspaceMode {
    return this.#mode;
  }

  setMode(mode: WorkspaceMode): WorkspaceMode {
    this.#mode = mode;
    this.#applyReadOnlyOption();
    this.#emitChange();
    return this.#mode;
  }

  toggleMode(): WorkspaceMode {
    return this.setMode(this.#mode === "read" ? "write" : "read");
  }

  onDidChange(listener: MaldivesWorkspaceListener): MaldivesWorkspaceSubscription {
    this.#listeners.add(listener);
    return { dispose: () => this.#listeners.delete(listener) };
  }

  open(uri: string, content: string): editor.ITextModel {
    const existing = this.#models.get(uri);

    if (existing) {
      this.switchTo(uri);
      return existing.model;
    }

    const model = this.#createModel(uri, content);
    const entry: WorkspaceEntry = {
      model,
      dirty: false,
      changeSubscription: model.onDidChangeContent(() => {
        const current = this.#models.get(uri);

        if (current) {
          current.dirty = true;
          this.#emitChange();
        }
      }),
    };

    this.#models.set(uri, entry);
    if (this.#panes.length === 0) {
      this.#activePaneId = this.#createPane(uri, "root").id;
    }
    this.switchTo(uri);
    return model;
  }

  close(uri: string): boolean {
    const entry = this.#models.get(uri);

    if (!entry) {
      return false;
    }

    const wasActive = this.#activeUri === uri;
    entry.changeSubscription.dispose();
    this.#models.delete(uri);
    this.#removePanesForUri(uri);
    entry.model.dispose();

    if (wasActive) {
      const nextUri = this.#models.keys().next().value as string | undefined;

      if (nextUri) {
        this.#activeUri = undefined;
        if (this.#panes.length === 0) {
          this.#activePaneId = this.#createPane(nextUri, "root").id;
        }
        this.switchTo(nextUri);
      } else {
        this.#activeUri = undefined;
        this.#activePaneId = undefined;
        this.#editor?.setModel(null);
      }
    }

    this.#emitChange();
    return true;
  }

  switchTo(uri: string): boolean {
    const entry = this.#models.get(uri);

    if (!entry) {
      this.#editor?.focus?.();
      return false;
    }

    if (this.#activeUri !== uri) {
      this.#saveActiveViewState();
    }
    this.#activeUri = uri;
    this.#setActivePaneUri(uri);
    this.#editor?.setModel(entry.model);

    if (entry.cursor) {
      this.#editor?.setPosition?.(entry.cursor);
      this.#editor?.setSelection?.({
        startLineNumber: entry.cursor.lineNumber,
        startColumn: entry.cursor.column,
        endLineNumber: entry.cursor.lineNumber,
        endColumn: entry.cursor.column,
      });
      const restoredUri = uri;
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => {
          if (this.#activeUri === restoredUri) {
            this.#editor?.setPosition?.(entry.cursor!);
            this.#editor?.setSelection?.({
              startLineNumber: entry.cursor!.lineNumber,
              startColumn: entry.cursor!.column,
              endLineNumber: entry.cursor!.lineNumber,
              endColumn: entry.cursor!.column,
            });
          }
        });
      }
    } else if (entry.viewState !== undefined) {
      this.#editor?.restoreViewState?.(entry.viewState);
    }

    this.#editor?.focus?.();
    this.#emitChange();
    return true;
  }

  isDirty(uri: string): boolean {
    return this.#models.get(uri)?.dirty ?? false;
  }

  markClean(uri: string): boolean {
    const entry = this.#models.get(uri);

    if (!entry) {
      return false;
    }

    entry.dirty = false;
    this.#emitChange();
    return true;
  }

  model(uri: string): editor.ITextModel | undefined {
    return this.#models.get(uri)?.model;
  }

  cursor(uri: string): WorkspaceCursor | undefined {
    return this.#models.get(uri)?.cursor;
  }

  setCursor(uri: string, cursor: WorkspaceCursor | undefined): boolean {
    const entry = this.#models.get(uri);

    if (!entry) {
      return false;
    }

    entry.cursor = cursor;
    return true;
  }

  uris(): string[] {
    return [...this.#models.keys()];
  }

  panes(): WorkspacePane[] {
    return this.#panes.map((pane) => ({ ...pane }));
  }

  splitRight(uri = this.#activeUri): WorkspacePane {
    return this.#split(uri, "right");
  }

  splitDown(uri = this.#activeUri): WorkspacePane {
    return this.#split(uri, "down");
  }

  movePane(paneId: string, targetIndex: number): boolean {
    const fromIndex = this.#panes.findIndex((pane) => pane.id === paneId);

    if (fromIndex === -1) {
      return false;
    }

    const [pane] = this.#panes.splice(fromIndex, 1);
    const nextIndex = Math.max(0, Math.min(targetIndex, this.#panes.length));
    this.#panes.splice(nextIndex, 0, pane);
    this.#emitChange();
    return true;
  }

  #applyReadOnlyOption(): void {
    this.#editor?.updateOptions?.({ readOnly: this.#mode === "read" });
  }

  #emitChange(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }

  #split(uri: string | undefined, direction: WorkspaceSplitDirection): WorkspacePane {
    if (!uri || !this.#models.has(uri)) {
      throw new Error(`Cannot split missing workspace model: ${uri ?? "<none>"}`);
    }

    const pane = this.#createPane(uri, direction);
    this.#activePaneId = pane.id;
    this.switchTo(uri);
    this.#emitChange();
    return { ...pane };
  }

  #createPane(uri: string, direction: WorkspaceSplitDirection): WorkspacePane {
    const pane: WorkspacePane = { id: `pane-${this.#nextPaneNumber++}`, uri, direction };
    this.#panes.push(pane);
    return pane;
  }

  #setActivePaneUri(uri: string): void {
    const activePane = this.#panes.find((pane) => pane.id === this.#activePaneId) ?? this.#panes[0];

    if (activePane) {
      this.#activePaneId = activePane.id;
      const index = this.#panes.findIndex((pane) => pane.id === activePane.id);
      this.#panes[index] = { ...activePane, uri };
    }
  }

  #removePanesForUri(uri: string): void {
    for (let index = this.#panes.length - 1; index >= 0; index -= 1) {
      if (this.#panes[index].uri === uri) {
        this.#panes.splice(index, 1);
      }
    }

    if (this.#activePaneId && !this.#panes.some((pane) => pane.id === this.#activePaneId)) {
      this.#activePaneId = this.#panes[0]?.id;
    }
  }

  #saveActiveViewState(): void {
    if (!this.#activeUri || !this.#editor?.saveViewState) {
      return;
    }

    const active = this.#models.get(this.#activeUri);

    if (active) {
      active.viewState = this.#editor.saveViewState();
      active.cursor = this.#editor.getPosition?.() ?? active.cursor;
    }
  }
}
