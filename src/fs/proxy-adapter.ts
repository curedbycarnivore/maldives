import { FileSystemAdapterError, type FileSystemAdapter, type FileSystemChange, type FileSystemEntry, type FileSystemWatcher } from "./types";

export interface ProxyFileSystemAdapterOptions {
  readonly origin: string | URL;
  readonly repo: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
}

type WatchCallback = (change: FileSystemChange) => void;

export class ProxyFileSystemAdapter implements FileSystemAdapter {
  readonly #origin: URL;
  readonly #repo: string;
  readonly #token: string;
  readonly #fetch: typeof fetch;
  readonly #watchers = new Map<string, Set<WatchCallback>>();

  constructor(options: ProxyFileSystemAdapterOptions) {
    this.#origin = normalizeOrigin(options.origin);
    this.#repo = normalizeRepo(options.repo);
    this.#token = options.token;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async readFile(path: string): Promise<string> {
    const normalized = normalizeWorkspacePath(path);
    const response = await this.#request(normalized, { method: "GET", headers: { accept: "text/plain" } });
    return response.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const normalized = normalizeWorkspacePath(path);
    await this.#request(normalized, {
      method: "PUT",
      body: content,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
    this.#emit({ type: "write", path: normalized });
  }

  async list(dir: string): Promise<FileSystemEntry[]> {
    const normalized = normalizeWorkspacePath(dir);
    const response = await this.#request(normalized, { method: "GET", headers: { accept: "application/json" }, list: true });
    const entries = await response.json();

    if (!Array.isArray(entries)) {
      throw new FileSystemAdapterError("EACCES", normalized, `Invalid Take5 list response for: ${normalized}`);
    }

    return entries.map(toFileSystemEntry).sort((a, b) => a.path.localeCompare(b.path));
  }

  watch(path: string, callback: WatchCallback): FileSystemWatcher {
    const normalized = normalizeWorkspacePath(path);
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

  async #request(path: string, init: RequestInit & { readonly list?: boolean }): Promise<Response> {
    const url = endpointUrl(this.#origin, this.#repo, path);

    if (init.list) {
      url.searchParams.set("list", "1");
    }

    const response = await this.#fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        "x-maldives-workspace-token": this.#token,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      throw new FileSystemAdapterError(errorCodeForStatus(response.status), path, `Take5 workspace request failed ${response.status}: ${path}`);
    }

    return response;
  }

  #emit(change: FileSystemChange): void {
    for (const path of watchedPathsFor(change.path)) {
      for (const callback of this.#watchers.get(path) ?? []) {
        callback(change);
      }
    }
  }
}

function normalizeOrigin(origin: string | URL): URL {
  const url = new URL(origin.toString());
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function normalizeRepo(repo: string): string {
  if (!repo || repo.includes("/") || repo.split(/[\\/]/).includes("..")) {
    throw new FileSystemAdapterError("ESECURITY", repo, `Invalid Take5 repo scope: ${repo}`);
  }

  return repo;
}

function normalizeWorkspacePath(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");
  const normalized = collapsed.length > 1 ? collapsed.replace(/\/+$/g, "") : collapsed;

  if (normalized.split("/").includes("..")) {
    throw new FileSystemAdapterError("ESECURITY", normalized, `Refusing Take5 traversal path: ${normalized}`);
  }

  return normalized;
}

function endpointUrl(origin: URL, repo: string, path: string): URL {
  const encodedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const url = new URL(origin);
  url.pathname = encodedPath ? `/workspace/${encodeURIComponent(repo)}/${encodedPath}` : `/workspace/${encodeURIComponent(repo)}`;
  return url;
}

function toFileSystemEntry(value: unknown): FileSystemEntry {
  if (!value || typeof value !== "object") {
    throw new FileSystemAdapterError("EACCES", "/", "Invalid Take5 list entry");
  }

  const entry = value as Partial<FileSystemEntry>;

  if ((entry.type !== "file" && entry.type !== "directory") || typeof entry.name !== "string" || typeof entry.path !== "string") {
    throw new FileSystemAdapterError("EACCES", "/", "Invalid Take5 list entry");
  }

  return { type: entry.type, name: entry.name, path: normalizeWorkspacePath(entry.path) };
}

function errorCodeForStatus(status: number): "ENOENT" | "EACCES" | "EFBIG" {
  if (status === 404) {
    return "ENOENT";
  }

  if (status === 413) {
    return "EFBIG";
  }

  return "EACCES";
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
