import type { editor } from "monaco-editor";
import type { FileSystemAdapter, FileSystemEntry } from "./fs/types";
import type { MaldivesWorkspace } from "./workspace";

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
  }
}

export interface FindInFilesOptions {
  readonly root?: string;
  readonly useRegex?: boolean;
  readonly caseSensitive?: boolean;
  readonly maxResults?: number;
}

export interface FindInFilesResult {
  readonly path: string;
  readonly lineNumber: number;
  readonly column: number;
  readonly preview: string;
}

export interface FindInFilesController {
  open(): void;
  search(query: string, options?: FindInFilesOptions): Promise<FindInFilesResult[]>;
  setAdapter(adapter: FileSystemAdapter): void;
  setRoot(root: string): void;
  readonly results: readonly FindInFilesResult[];
}

const DEFAULT_ROOT = "/";
const DEFAULT_MAX_RESULTS = 200;

export async function findInFiles(
  adapter: FileSystemAdapter,
  query: string,
  options: FindInFilesOptions = {},
): Promise<FindInFilesResult[]> {
  const needle = compileNeedle(query, options);

  if (!needle) {
    return [];
  }

  const root = normalizePath(options.root ?? DEFAULT_ROOT);
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const files = await collectFiles(adapter, root);
  const results: FindInFilesResult[] = [];

  for (const file of files) {
    const content = await adapter.readFile(file.path);

    for (const result of matchesInFile(file.path, content, needle)) {
      results.push(result);

      if (results.length >= maxResults) {
        return results;
      }
    }
  }

  return results;
}

export function installFindInFilesPanel(
  host: HTMLElement,
  options: { adapter: FileSystemAdapter; editor: editor.IStandaloneCodeEditor; workspace?: MaldivesWorkspace; root?: string },
): FindInFilesController {
  let adapter = options.adapter;
  let root = normalizePath(options.root ?? DEFAULT_ROOT);
  let results: FindInFilesResult[] = [];

  const controller: FindInFilesController = {
    get results() {
      return results;
    },
    setAdapter(nextAdapter) {
      adapter = nextAdapter;
    },
    setRoot(nextRoot) {
      root = normalizePath(nextRoot);
    },
    open() {
      renderPanel();
    },
    async search(query, searchOptions = {}) {
      results = await findInFiles(adapter, query, { root, ...searchOptions });
      renderPanel(query);
      return results;
    },
  };

  async function openResult(result: FindInFilesResult): Promise<void> {
    const content = await adapter.readFile(result.path);
    const uri = `opfs://${result.path}`;
    const model = options.workspace?.open(uri, content) ?? openStandaloneModel(options.editor, uri, content);
    const column = Math.max(1, result.column);

    options.editor.setModel(model);
    options.editor.setPosition({ lineNumber: result.lineNumber, column });
    options.editor.revealLineInCenter(result.lineNumber);
    options.editor.focus();
  }

  function renderPanel(query = ""): void {
    host.querySelector(".maldives-find-in-files")?.remove();

    const panel = document.createElement("section");
    panel.className = "maldives-find-in-files";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Find in Files");
    panel.style.cssText = [
      "position:fixed",
      "left:24px",
      "right:24px",
      "bottom:24px",
      "z-index:10000",
      "max-height:46vh",
      "background:#1e1e1e",
      "color:#d4d4d4",
      "border:1px solid #3c3c3c",
      "box-shadow:0 12px 36px rgba(0,0,0,.45)",
      "font:13px JetBrains Mono, monospace",
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #333;background:#252526";

    const title = document.createElement("strong");
    title.textContent = "Find in Files";
    title.style.cssText = "color:#fff";

    const input = document.createElement("input");
    input.className = "maldives-find-in-files-input";
    input.value = query;
    input.placeholder = "Search project files…";
    input.style.cssText = "flex:1;background:#1e1e1e;color:#d4d4d4;border:1px solid #555;padding:6px 8px";

    const search = document.createElement("button");
    search.className = "maldives-find-in-files-search";
    search.type = "button";
    search.textContent = "Search";
    search.style.cssText = "background:#2d2d2d;color:#d4d4d4;border:1px solid #666;padding:6px 10px;cursor:pointer";
    search.addEventListener("click", () => void controller.search(input.value));

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Hide";
    close.style.cssText = search.style.cssText;
    close.addEventListener("click", () => {
      panel.remove();
      options.editor.focus();
    });

    header.append(title, input, search, close);
    panel.append(header, resultsList(results, openResult));
    host.append(panel);
    input.focus();
  }

  return controller;
}

function openStandaloneModel(editorInstance: editor.IStandaloneCodeEditor, uri: string, content: string): editor.ITextModel {
  const monacoEditor = globalThis.window?.__monaco.editor;
  const parsedUri = globalThis.window.__monaco.Uri.parse(uri);
  const existing = monacoEditor.getModel(parsedUri);
  const model = existing ?? monacoEditor.createModel(content, uri.endsWith(".tsx") || uri.endsWith(".ts") ? "typescript" : undefined, parsedUri);

  model.setValue(content);
  editorInstance.setModel(model);
  return model;
}

function resultsList(results: FindInFilesResult[], openResult: (result: FindInFilesResult) => Promise<void>): HTMLElement {
  const list = document.createElement("div");
  list.className = "maldives-find-in-files-results";
  list.style.cssText = "overflow:auto;max-height:calc(46vh - 52px)";

  if (results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "maldives-find-in-files-empty";
    empty.textContent = "No results yet. Search OPFS/FSA-backed project files.";
    empty.style.cssText = "padding:12px;color:#969696";
    list.append(empty);
    return list;
  }

  for (const result of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maldives-find-in-files-result";
    button.style.cssText = "display:block;width:100%;text-align:left;background:transparent;color:inherit;border:0;border-bottom:1px solid #2d2d2d;padding:8px 12px;cursor:pointer";
    button.addEventListener("click", () => void openResult(result));

    const path = document.createElement("div");
    path.textContent = `${result.path}:${result.lineNumber}:${result.column}`;
    path.style.cssText = "color:#9cdcfe;margin-bottom:3px";

    const preview = document.createElement("div");
    preview.textContent = result.preview;
    preview.style.cssText = "white-space:pre;overflow:hidden;text-overflow:ellipsis";

    button.append(path, preview);
    list.append(button);
  }

  return list;
}

async function collectFiles(adapter: FileSystemAdapter, root: string): Promise<FileSystemEntry[]> {
  const entries = await adapter.list(root);
  const files: FileSystemEntry[] = [];

  for (const entry of entries) {
    if (entry.type === "file") {
      files.push(entry);
    } else {
      files.push(...await collectFiles(adapter, entry.path));
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function matchesInFile(path: string, content: string, needle: RegExp): FindInFilesResult[] {
  const matches: FindInFilesResult[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const regex = new RegExp(needle.source, needle.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      matches.push({
        path,
        lineNumber: index + 1,
        column: match.index + 1,
        preview: line.trim(),
      });

      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
  }

  return matches;
}

function compileNeedle(query: string, options: FindInFilesOptions): RegExp | undefined {
  if (!query) {
    return undefined;
  }

  const flags = `g${options.caseSensitive ? "" : "i"}`;

  try {
    return options.useRegex ? new RegExp(query, flags) : new RegExp(escapeRegExp(query), flags);
  } catch {
    return undefined;
  }
}

function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/g, "") : collapsed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
