export type FileSystemEntryType = "file" | "directory";

export interface FileSystemEntry {
  readonly type: FileSystemEntryType;
  readonly name: string;
  readonly path: string;
}

export interface FileSystemChange {
  readonly type: "write";
  readonly path: string;
}

export interface FileSystemWatcher {
  dispose(): void;
}

export interface FileSystemAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  list(dir: string): Promise<FileSystemEntry[]>;
  watch(path: string, callback: (change: FileSystemChange) => void): FileSystemWatcher;
}

export class FileSystemAdapterError extends Error {
  readonly code: "ENOENT";
  readonly path: string;

  constructor(code: "ENOENT", path: string) {
    super(`${code}: ${path}`);
    this.name = "FileSystemAdapterError";
    this.code = code;
    this.path = path;
  }
}
