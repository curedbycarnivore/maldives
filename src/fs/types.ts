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

export interface FileSystemWriteOptions {
  readonly userGesture?: boolean;
}

export interface FileSystemAdapter {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string, options?: FileSystemWriteOptions): Promise<void>;
  list(dir: string): Promise<FileSystemEntry[]>;
  watch(path: string, callback: (change: FileSystemChange) => void): FileSystemWatcher;
}

export type FileSystemAdapterErrorCode = "ENOENT" | "EACCES" | "EFBIG" | "ESECURITY";

export class FileSystemAdapterError extends Error {
  readonly code: FileSystemAdapterErrorCode;
  readonly path: string;

  constructor(code: FileSystemAdapterErrorCode, path: string, message = `${code}: ${path}`) {
    super(message);
    this.name = "FileSystemAdapterError";
    this.code = code;
    this.path = path;
  }
}
