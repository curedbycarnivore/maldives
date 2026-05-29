import { FileSystemAdapterError, type FileSystemAdapter, type FileSystemChange, type FileSystemEntry, type FileSystemWatcher } from "./types";

type WatchCallback = (change: FileSystemChange) => void;

export class MemoryFileSystemAdapter implements FileSystemAdapter {
  readonly #files = new Map<string, string>();
  readonly #watchers = new Map<string, Set<WatchCallback>>();

  constructor(files: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(files)) {
      this.#files.set(normalizePath(path), content);
    }
  }

  async readFile(path: string): Promise<string> {
    const normalized = normalizePath(path);
    const content = this.#files.get(normalized);

    if (content === undefined) {
      throw new FileSystemAdapterError("ENOENT", normalized);
    }

    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalized = normalizePath(path);
    this.#files.set(normalized, content);
    this.#emit({ type: "write", path: normalized });
  }

  async list(dir: string): Promise<FileSystemEntry[]> {
    const normalizedDir = normalizePath(dir);
    const prefix = normalizedDir === "/" ? "/" : `${normalizedDir}/`;
    const entries = new Map<string, FileSystemEntry>();

    for (const path of this.#files.keys()) {
      if (!path.startsWith(prefix) || path === normalizedDir) {
        continue;
      }

      const rest = path.slice(prefix.length);
      const [name, ...nested] = rest.split("/");

      if (!name) {
        continue;
      }

      const type = nested.length === 0 ? "file" : "directory";
      entries.set(name, { type, name, path: normalizedDir === "/" ? `/${name}` : `${normalizedDir}/${name}` });
    }

    return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  watch(path: string, callback: WatchCallback): FileSystemWatcher {
    const normalized = normalizePath(path);
    let callbacks = this.#watchers.get(normalized);

    if (!callbacks) {
      callbacks = new Set();
      this.#watchers.set(normalized, callbacks);
    }

    callbacks.add(callback);

    return {
      dispose: () => {
        callbacks?.delete(callback);

        if (callbacks?.size === 0) {
          this.#watchers.delete(normalized);
        }
      },
    };
  }

  #emit(change: FileSystemChange): void {
    for (const path of watchedPathsFor(change.path)) {
      for (const callback of this.#watchers.get(path) ?? []) {
        callback(change);
      }
    }
  }
}

export function createMemoryFileSystemAdapter(files?: Record<string, string>): MemoryFileSystemAdapter {
  return new MemoryFileSystemAdapter(files);
}

function normalizePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/g, "") : collapsed;
}

function watchedPathsFor(path: string): string[] {
  const paths = [path];
  let current = parentPath(path);

  while (current) {
    paths.push(current);
    current = current === "/" ? undefined : parentPath(current);
  }

  return paths;
}

function parentPath(path: string): string | undefined {
  const index = path.lastIndexOf("/");

  if (index < 0) {
    return undefined;
  }

  return index === 0 ? "/" : path.slice(0, index);
}
