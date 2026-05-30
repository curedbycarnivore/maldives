import { FileSystemAdapterError, type FileSystemAdapter, type FileSystemChange, type FileSystemEntry, type FileSystemWatcher, type FileSystemWriteOptions } from "./types";

export interface OpfsWritableFileStreamLike {
  write(content: string): Promise<void>;
  close(): Promise<void>;
}

export interface OpfsFileHandleLike {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<OpfsWritableFileStreamLike>;
}

export interface OpfsDirectoryHandleLike {
  readonly kind: "directory";
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandleLike>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectoryHandleLike>;
  entries(): AsyncIterable<[string, OpfsHandleLike]>;
}

export type OpfsHandleLike = OpfsFileHandleLike | OpfsDirectoryHandleLike;

export interface OpfsHost {
  getDirectory(): Promise<OpfsDirectoryHandleLike>;
}

export interface OpfsFileSystemAdapterOptions {
  readonly maxWriteBytes?: number;
}

const DEFAULT_MAX_WRITE_BYTES = 5 * 1024 * 1024;

export class OpfsFileSystemAdapter implements FileSystemAdapter {
  readonly #host: OpfsHost;
  readonly #maxWriteBytes: number;
  readonly #watchers = new Map<string, Set<(change: FileSystemChange) => void>>();

  constructor(host: OpfsHost = browserOpfsHost(), options: OpfsFileSystemAdapterOptions = {}) {
    this.#host = host;
    this.#maxWriteBytes = options.maxWriteBytes ?? DEFAULT_MAX_WRITE_BYTES;
  }

  async readFile(path: string): Promise<string> {
    const normalized = safePath(path);
    const handle = await this.#fileHandleFor(normalized, false);
    const file = await handle.getFile();
    return file.text();
  }

  async writeFile(path: string, content: string, _options: FileSystemWriteOptions = {}): Promise<void> {
    const normalized = safePath(path);

    if (new TextEncoder().encode(content).byteLength > this.#maxWriteBytes) {
      throw new FileSystemAdapterError("EFBIG", normalized, `Refusing to write file over ${this.#maxWriteBytes} bytes: ${normalized}`);
    }

    const handle = await this.#fileHandleFor(normalized, true);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    this.#notify(normalized);
  }

  async list(dir: string): Promise<FileSystemEntry[]> {
    const normalized = safePath(dir);
    const handle = await this.#directoryFor(normalized, false);
    const entries: FileSystemEntry[] = [];

    for await (const [name, child] of handle.entries()) {
      entries.push({
        type: child.kind,
        name,
        path: normalizePath(`${normalized}/${name}`),
      });
    }

    return entries.sort((a, b) => a.path.localeCompare(b.path));
  }

  watch(path: string, callback: (change: FileSystemChange) => void): FileSystemWatcher {
    const normalized = safePath(path);
    const callbacks = this.#watchers.get(normalized) ?? new Set<(change: FileSystemChange) => void>();
    callbacks.add(callback);
    this.#watchers.set(normalized, callbacks);
    return {
      dispose: () => callbacks.delete(callback),
    };
  }

  async #fileHandleFor(path: string, create: boolean): Promise<OpfsFileHandleLike> {
    const parts = pathParts(path);
    const fileName = parts.at(-1);

    if (!fileName) {
      throw new FileSystemAdapterError("ESECURITY", path, `OPFS file path must include a file name: ${path}`);
    }

    const dirPath = `/${parts.slice(0, -1).join("/")}`;
    const dir = await this.#directoryFor(dirPath, create);

    try {
      return await dir.getFileHandle(fileName, { create });
    } catch (error) {
      throw toAdapterError(error, path);
    }
  }

  async #directoryFor(path: string, create: boolean): Promise<OpfsDirectoryHandleLike> {
    const parts = pathParts(path);
    let current = await this.#root();

    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part, { create });
      } catch (error) {
        throw toAdapterError(error, path);
      }
    }

    return current;
  }

  #root(): Promise<OpfsDirectoryHandleLike> {
    return this.#host.getDirectory();
  }

  #notify(path: string): void {
    const change = { type: "write" as const, path };

    for (const [watchedPath, callbacks] of this.#watchers) {
      if (path === watchedPath || path.startsWith(`${watchedPath}/`)) {
        for (const callback of callbacks) callback(change);
      }
    }
  }
}

export function createOpfsFileSystemAdapter(options?: OpfsFileSystemAdapterOptions): OpfsFileSystemAdapter {
  return new OpfsFileSystemAdapter(browserOpfsHost(), options);
}

function browserOpfsHost(): OpfsHost {
  return {
    async getDirectory() {
      const storage = globalThis.navigator?.storage as { getDirectory?: () => Promise<OpfsDirectoryHandleLike> } | undefined;

      if (!storage?.getDirectory) {
        throw new Error("Origin Private File System is unavailable in this browser.");
      }

      return storage.getDirectory();
    },
  };
}

function safePath(path: string): string {
  const normalized = normalizePath(path);

  if (normalized.split("/").includes("..")) {
    throw new FileSystemAdapterError("ESECURITY", normalized, `Refusing to access traversal path: ${normalized}`);
  }

  return normalized;
}

function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/g, "") : collapsed;
}

function pathParts(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function toAdapterError(error: unknown, path: string): FileSystemAdapterError {
  if (error instanceof FileSystemAdapterError) {
    return error;
  }

  return new FileSystemAdapterError("ENOENT", path, error instanceof Error ? error.message : `OPFS path not found: ${path}`);
}
