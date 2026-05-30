import type { editor } from "monaco-editor";

export type WorkspaceMode = "read" | "write";

export interface MaldivesWorkspaceEditor {
  setModel(model: editor.ITextModel | null): void;
  saveViewState?(): unknown;
  restoreViewState?(state: unknown): void;
  updateOptions?(options: { readOnly: boolean }): void;
  focus?(): void;
}

export interface MaldivesWorkspaceOptions {
  createModel(uri: string, content: string): editor.ITextModel;
  editor?: MaldivesWorkspaceEditor;
  initialMode?: WorkspaceMode;
}

interface WorkspaceEntry {
  model: editor.ITextModel;
  dirty: boolean;
  viewState?: unknown;
  changeSubscription: { dispose: () => void };
}

export class MaldivesWorkspace {
  readonly #models = new Map<string, WorkspaceEntry>();
  readonly #createModel: MaldivesWorkspaceOptions["createModel"];
  readonly #editor?: MaldivesWorkspaceEditor;
  #activeUri: string | undefined;
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
    return this.#mode;
  }

  toggleMode(): WorkspaceMode {
    return this.setMode(this.#mode === "read" ? "write" : "read");
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
        }
      }),
    };

    this.#models.set(uri, entry);
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
    entry.model.dispose();

    if (wasActive) {
      const nextUri = this.#models.keys().next().value as string | undefined;

      if (nextUri) {
        this.#activeUri = undefined;
        this.switchTo(nextUri);
      } else {
        this.#activeUri = undefined;
        this.#editor?.setModel(null);
      }
    }

    return true;
  }

  switchTo(uri: string): boolean {
    const entry = this.#models.get(uri);

    if (!entry) {
      this.#editor?.focus?.();
      return false;
    }

    this.#saveActiveViewState();
    this.#activeUri = uri;
    this.#editor?.setModel(entry.model);

    if (entry.viewState !== undefined) {
      this.#editor?.restoreViewState?.(entry.viewState);
    }

    this.#editor?.focus?.();
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
    return true;
  }

  model(uri: string): editor.ITextModel | undefined {
    return this.#models.get(uri)?.model;
  }

  uris(): string[] {
    return [...this.#models.keys()];
  }

  #applyReadOnlyOption(): void {
    this.#editor?.updateOptions?.({ readOnly: this.#mode === "read" });
  }

  #saveActiveViewState(): void {
    if (!this.#activeUri || !this.#editor?.saveViewState) {
      return;
    }

    const active = this.#models.get(this.#activeUri);

    if (active) {
      active.viewState = this.#editor.saveViewState();
    }
  }
}
