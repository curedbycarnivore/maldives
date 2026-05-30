import { FileSystemAdapterError } from "./fs";

export type GitFileStatusKind = "added" | "modified" | "deleted";

export interface GitStatusEntry {
  readonly path: string;
  readonly status: GitFileStatusKind;
  readonly lines?: readonly number[];
}

export interface GitBlameEntry {
  readonly path: string;
  readonly line: number;
  readonly author: string;
  readonly commit: string;
  readonly summary: string;
}

export interface GitDiffHunk {
  readonly path: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: readonly string[];
}

export interface GitStateProvider {
  status(): Promise<readonly GitStatusEntry[]>;
  blame(path: string, line: number): Promise<GitBlameEntry>;
  diff(path: string): Promise<readonly GitDiffHunk[]>;
}

export interface Take5GitProxyClientOptions {
  readonly origin: string | URL;
  readonly repo: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
}

export class Take5GitProxyClient implements GitStateProvider {
  readonly #origin: URL;
  readonly #repo: string;
  readonly #token: string;
  readonly #fetch: typeof fetch;

  constructor(options: Take5GitProxyClientOptions) {
    this.#origin = normalizeOrigin(options.origin);
    this.#repo = normalizeRepo(options.repo);
    this.#token = options.token;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async status(): Promise<readonly GitStatusEntry[]> {
    const payload = await this.#json(endpointUrl(this.#origin, this.#repo, ["git", "status"]));

    if (!Array.isArray(payload)) {
      throw new FileSystemAdapterError("EACCES", "/git/status", "Invalid Take5 git status response");
    }

    return payload.map(toStatusEntry);
  }

  async blame(path: string, line: number): Promise<GitBlameEntry> {
    const normalized = normalizeWorkspacePath(path);

    if (!Number.isInteger(line) || line < 1) {
      throw new FileSystemAdapterError("EACCES", normalized, `Invalid Take5 blame line: ${line}`);
    }

    const url = endpointUrl(this.#origin, this.#repo, ["git", "blame"]);
    url.searchParams.set("path", normalized);
    url.searchParams.set("line", String(line));
    return toBlameEntry(await this.#json(url));
  }

  async diff(path: string): Promise<readonly GitDiffHunk[]> {
    const normalized = normalizeWorkspacePath(path);
    const url = endpointUrl(this.#origin, this.#repo, ["git", "diff"]);
    url.searchParams.set("path", normalized);
    const payload = await this.#json(url);

    if (!Array.isArray(payload)) {
      throw new FileSystemAdapterError("EACCES", normalized, "Invalid Take5 git diff response");
    }

    return payload.map(toDiffHunk);
  }

  async #json(url: URL): Promise<unknown> {
    const response = await this.#fetch(url, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "x-maldives-workspace-token": this.#token,
      },
    });

    if (!response.ok) {
      throw new FileSystemAdapterError(response.status === 404 ? "ENOENT" : "EACCES", url.pathname, `Take5 git request failed ${response.status}`);
    }

    const mimeType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
    if (mimeType !== "application/json") {
      throw new FileSystemAdapterError("ESECURITY", url.pathname, `Unexpected Take5 git content-type: ${mimeType || "<missing>"}`);
    }

    return response.json();
  }
}

export function normalizeGitPathFromUri(uri: string): string {
  const parsed = uri.startsWith("file://") ? new URL(uri).pathname : uri;
  const withoutWorkspacePrefix = parsed.startsWith("/workspace/") ? parsed.slice("/workspace".length) : parsed;
  return normalizeWorkspacePath(withoutWorkspacePrefix);
}

function normalizeOrigin(origin: string | URL): URL {
  const url = new URL(origin.toString());

  const isLocalDevOrigin = url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");

  if (url.protocol !== "https:" && !isLocalDevOrigin) {
    throw new FileSystemAdapterError("ESECURITY", url.origin, `Take5 git proxy requires HTTPS or same-machine dev origin: ${url.origin}`);
  }

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
    throw new FileSystemAdapterError("ESECURITY", normalized, `Refusing Take5 git traversal path: ${normalized}`);
  }

  return normalized;
}

function endpointUrl(origin: URL, repo: string, parts: readonly string[]): URL {
  const url = new URL(origin);
  const suffix = parts.map((part) => encodeURIComponent(part)).join("/");
  url.pathname = `/workspace/${encodeURIComponent(repo)}/${suffix}`;
  return url;
}

function toStatusEntry(value: unknown): GitStatusEntry {
  if (!value || typeof value !== "object") {
    throw new FileSystemAdapterError("EACCES", "/git/status", "Invalid Take5 git status entry");
  }

  const entry = value as Partial<GitStatusEntry>;
  if ((entry.status !== "added" && entry.status !== "modified" && entry.status !== "deleted") || typeof entry.path !== "string") {
    throw new FileSystemAdapterError("EACCES", "/git/status", "Invalid Take5 git status entry");
  }

  return {
    path: normalizeWorkspacePath(entry.path),
    status: entry.status,
    lines: Array.isArray(entry.lines) ? entry.lines.filter((line): line is number => Number.isInteger(line) && line > 0) : undefined,
  };
}

function toBlameEntry(value: unknown): GitBlameEntry {
  if (!value || typeof value !== "object") {
    throw new FileSystemAdapterError("EACCES", "/git/blame", "Invalid Take5 git blame response");
  }

  const entry = value as Partial<GitBlameEntry>;
  if (typeof entry.path !== "string" || !Number.isInteger(entry.line) || typeof entry.author !== "string" || typeof entry.commit !== "string" || typeof entry.summary !== "string") {
    throw new FileSystemAdapterError("EACCES", "/git/blame", "Invalid Take5 git blame response");
  }

  return {
    path: normalizeWorkspacePath(entry.path),
    line: entry.line as number,
    author: entry.author,
    commit: entry.commit,
    summary: entry.summary,
  };
}

function toDiffHunk(value: unknown): GitDiffHunk {
  if (!value || typeof value !== "object") {
    throw new FileSystemAdapterError("EACCES", "/git/diff", "Invalid Take5 git diff hunk");
  }

  const hunk = value as Partial<GitDiffHunk>;
  if (
    typeof hunk.path !== "string" ||
    !Number.isInteger(hunk.oldStart) ||
    !Number.isInteger(hunk.oldLines) ||
    !Number.isInteger(hunk.newStart) ||
    !Number.isInteger(hunk.newLines) ||
    !Array.isArray(hunk.lines)
  ) {
    throw new FileSystemAdapterError("EACCES", "/git/diff", "Invalid Take5 git diff hunk");
  }

  return {
    path: normalizeWorkspacePath(hunk.path),
    oldStart: hunk.oldStart as number,
    oldLines: hunk.oldLines as number,
    newStart: hunk.newStart as number,
    newLines: hunk.newLines as number,
    lines: hunk.lines.filter((line): line is string => typeof line === "string"),
  };
}
