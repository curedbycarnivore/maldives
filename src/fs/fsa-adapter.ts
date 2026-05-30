import { FileSystemAdapterError, type FileSystemAdapter, type FileSystemChange, type FileSystemEntry, type FileSystemWatcher, type FileSystemWriteOptions } from "./types";
import type { MaldivesWorkspace } from "../workspace";

export type FileSystemPermissionStateLike = "granted" | "denied" | "prompt";

export interface FileSystemWritableFileStreamLike {
  write(content: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemFileHandleLike {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  requestPermission?(descriptor: { mode: "readwrite" }): Promise<FileSystemPermissionStateLike>;
  createWritable?(): Promise<FileSystemWritableFileStreamLike>;
}

export interface FileSystemDirectoryHandleLike {
  readonly kind: "directory";
  readonly name: string;
  entries(): AsyncIterable<[string, FileSystemHandleLike]>;
}

export type FileSystemHandleLike = FileSystemFileHandleLike | FileSystemDirectoryHandleLike;

export interface FileSystemAccessHost {
  showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<readonly FileSystemFileHandleLike[]>;
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
}

export interface OpenedFile {
  readonly path: string;
  readonly content: string;
}

export interface OpenedWorkspaceFile extends OpenedFile {
  readonly uri: string;
}

export interface FileSystemAccessAdapterOptions {
  readonly maxWriteBytes?: number;
}

export type FileSystemAccessWriteOptions = FileSystemWriteOptions;

const DEFAULT_MAX_WRITE_BYTES = 5 * 1024 * 1024;

export class FileSystemAccessAdapter implements FileSystemAdapter {
  readonly #host: FileSystemAccessHost;
  readonly #maxWriteBytes: number;
  readonly #files = new Map<string, FileSystemFileHandleLike>();
  readonly #directories = new Map<string, FileSystemDirectoryHandleLike>();

  constructor(host: FileSystemAccessHost = globalThis as FileSystemAccessHost, options: FileSystemAccessAdapterOptions = {}) {
    this.#host = host;
    this.#maxWriteBytes = options.maxWriteBytes ?? DEFAULT_MAX_WRITE_BYTES;
  }

  async openFile(): Promise<OpenedFile> {
    const pick = this.#host.showOpenFilePicker;

    if (!pick) {
      throw new Error("File System Access API showOpenFilePicker is unavailable in this browser.");
    }

    const [handle] = await pick({ multiple: false });

    if (!handle) {
      throw new FileSystemAdapterError("ENOENT", "/");
    }

    const path = normalizePath(`/${handle.name}`);
    this.#files.set(path, handle);

    return { path, content: await readHandleText(handle) };
  }

  async readFile(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const handle = this.#files.get(normalized);

    if (!handle) {
      throw new FileSystemAdapterError("ENOENT", normalized);
    }

    return readHandleText(handle);
  }

  async writeFile(path: string, content: string, options: FileSystemAccessWriteOptions = {}): Promise<void> {
    const normalized = normalizePath(path);

    if (hasTraversalSegment(normalized)) {
      throw new FileSystemAdapterError("ESECURITY", normalized, `Refusing to write traversal path: ${normalized}`);
    }

    if (new TextEncoder().encode(content).byteLength > this.#maxWriteBytes) {
      throw new FileSystemAdapterError("EFBIG", normalized, `Refusing to write file over ${this.#maxWriteBytes} bytes: ${normalized}`);
    }

    if (!options.userGesture) {
      throw new FileSystemAdapterError("EACCES", normalized, `A user gesture is required to write: ${normalized}`);
    }

    const handle = this.#files.get(normalized);

    if (!handle) {
      throw new FileSystemAdapterError("ENOENT", normalized);
    }

    if (!handle.requestPermission || !handle.createWritable) {
      throw new FileSystemAdapterError("EACCES", normalized, `This browser file handle cannot be written: ${normalized}`);
    }

    const permission = await handle.requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      throw new FileSystemAdapterError("EACCES", normalized, `Readwrite permission denied for: ${normalized}`);
    }

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async list(dir: string): Promise<FileSystemEntry[]> {
    const normalized = normalizePath(dir);
    const handle = await this.#directoryFor(normalized);
    const entries: FileSystemEntry[] = [];

    for await (const [name, child] of handle.entries()) {
      const childPath = normalizePath(`${normalized}/${name}`);

      if (child.kind === "file") {
        this.#files.set(childPath, child);
      } else {
        this.#directories.set(childPath, child);
      }

      entries.push({ type: child.kind, name, path: childPath });
    }

    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }

  watch(_path: string, _callback: (change: FileSystemChange) => void): FileSystemWatcher {
    return { dispose: () => undefined };
  }

  async #directoryFor(path: string): Promise<FileSystemDirectoryHandleLike> {
    const cached = this.#directories.get(path);

    if (cached) {
      return cached;
    }

    const pick = this.#host.showDirectoryPicker;

    if (!pick) {
      throw new Error("File System Access API showDirectoryPicker is unavailable in this browser.");
    }

    const handle = await pick();
    this.#directories.set(path, handle);
    return handle;
  }
}

export async function openPickedFileInWorkspace(
  adapter: FileSystemAccessAdapter,
  workspace: Pick<MaldivesWorkspace, "open">,
): Promise<OpenedWorkspaceFile> {
  const opened = await adapter.openFile();
  const uri = fileUriForFsaPath(opened.path);
  workspace.open(uri, opened.content);
  return { ...opened, uri };
}

export async function saveWorkspaceFile(
  adapter: FileSystemAccessAdapter,
  workspace: Pick<MaldivesWorkspace, "markClean">,
  uri: string,
  content: string,
  options: FileSystemAccessWriteOptions,
): Promise<void> {
  await adapter.writeFile(fsaPathForFileUri(uri), content, options);
  workspace.markClean(uri);
}

export function installOpenFileButton(container: HTMLElement, adapter: FileSystemAccessAdapter, workspace: Pick<MaldivesWorkspace, "open">): void {
  if (container.querySelector(".maldives-open-file-button")) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "maldives-open-file-button";
  button.textContent = "Open file";
  button.style.cssText = [
    "position:fixed",
    "left:16px",
    "bottom:16px",
    "z-index:10001",
    "background:#0e639c",
    "color:#fff",
    "border:0",
    "border-radius:4px",
    "padding:8px 10px",
    "font:12px system-ui,sans-serif",
  ].join(";");
  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      await openPickedFileInWorkspace(adapter, workspace);
    } finally {
      button.disabled = false;
    }
  });
  container.appendChild(button);
}

export function fileUriForFsaPath(path: string): string {
  return `file://${normalizePath(path)}`;
}

export function fsaPathForFileUri(uri: string): string {
  const parsed = new URL(uri);

  if (parsed.protocol !== "file:") {
    throw new FileSystemAdapterError("ESECURITY", uri, `Only file:// URIs can be saved through FSA: ${uri}`);
  }

  return normalizePath(decodeURIComponent(parsed.pathname));
}

async function readHandleText(handle: FileSystemFileHandleLike): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/g, "") : collapsed;
}

function hasTraversalSegment(path: string): boolean {
  return path.split("/").includes("..");
}
