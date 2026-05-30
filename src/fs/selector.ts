import { FileSystemAccessAdapter, type FileSystemAccessAdapterOptions, type FileSystemAccessHost } from "./fsa-adapter";
import { MemoryFileSystemAdapter } from "./memory-adapter";
import { OpfsFileSystemAdapter, type OpfsFileSystemAdapterOptions } from "./opfs-adapter";
import { ProxyFileSystemAdapter, type ProxyFileSystemAdapterOptions } from "./proxy-adapter";
import type { FileSystemAdapter } from "./types";

export type FileSystemAdapterInit =
  | "fsa"
  | "opfs"
  | FileSystemAdapter
  | { readonly type: "fsa"; readonly host?: FileSystemAccessHost; readonly options?: FileSystemAccessAdapterOptions }
  | { readonly type: "memory"; readonly files?: Record<string, string> }
  | ({ readonly type: "opfs" } & OpfsFileSystemAdapterOptions)
  | ({ readonly type: "proxy" } & ProxyFileSystemAdapterOptions);

export function resolveFileSystemAdapter(init: FileSystemAdapterInit = "fsa"): FileSystemAdapter {
  if (typeof init === "string") {
    return init === "opfs" ? new OpfsFileSystemAdapter() : new FileSystemAccessAdapter();
  }

  if (isFileSystemAdapter(init)) {
    return init;
  }

  switch (init.type) {
    case "fsa":
      return new FileSystemAccessAdapter(init.host, init.options);
    case "memory":
      return new MemoryFileSystemAdapter(init.files);
    case "opfs": {
      const { type: _type, ...options } = init;
      return new OpfsFileSystemAdapter(undefined, options);
    }
    case "proxy": {
      const { type: _type, ...options } = init;
      return new ProxyFileSystemAdapter(options);
    }
  }
}

export function isFileSystemAdapter(value: unknown): value is FileSystemAdapter {
  return Boolean(
    value &&
      typeof value === "object" &&
      "readFile" in value &&
      "writeFile" in value &&
      "list" in value &&
      "watch" in value &&
      typeof value.readFile === "function" &&
      typeof value.writeFile === "function" &&
      typeof value.list === "function" &&
      typeof value.watch === "function",
  );
}
