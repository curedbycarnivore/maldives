import { describe, expect, test, vi } from "vitest";
import { OpfsFileSystemAdapter } from "../src/fs/opfs-adapter";

const complexEffectSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function repository(_: unknown, _context: ClassDecoratorContext) {}

@repository
class OpfsUserRepository<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String, revision: Schema.Number });

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(this.schema)({ id, revision: 1 });
      return { ...parsed, seed: this.seed } satisfies A & { readonly seed: string };
    }.bind(this));
  }

  constructor(readonly seed: string) {}
}

const OpfsRepo = Context.GenericTag<OpfsUserRepository<{ readonly id: string }>>("OpfsRepo");
export const OpfsRepoLive = Layer.succeed(OpfsRepo, new OpfsUserRepository("disk"));
export const program = pipe(Effect.succeed("42"), Effect.flatMap((id) => new OpfsUserRepository(id).load(id)));
`;

describe("OpfsFileSystemAdapter", () => {
  test("round-trips complex TSX content through fresh OPFS handles and lists direct children", async () => {
    const root = directoryHandle("", {});
    const adapter = new OpfsFileSystemAdapter({ getDirectory: vi.fn(async () => root) });
    const freshAdapter = new OpfsFileSystemAdapter({ getDirectory: vi.fn(async () => root) });
    const watcher = vi.fn();

    adapter.watch("/workspace/src/effect-app.tsx", watcher);
    await adapter.writeFile("/workspace/src/effect-app.tsx", complexEffectSource);

    await expect(freshAdapter.readFile("/workspace/src/effect-app.tsx")).resolves.toBe(complexEffectSource);
    await expect(freshAdapter.list("/workspace")).resolves.toEqual([{ type: "directory", name: "src", path: "/workspace/src" }]);
    await expect(freshAdapter.list("/workspace/src")).resolves.toEqual([
      { type: "file", name: "effect-app.tsx", path: "/workspace/src/effect-app.tsx" },
    ]);
    expect(watcher).toHaveBeenCalledWith({ type: "write", path: "/workspace/src/effect-app.tsx" });
  });

  test("rejects traversal and oversized writes before creating an OPFS writable", async () => {
    const root = directoryHandle("", {});
    const adapter = new OpfsFileSystemAdapter({ getDirectory: vi.fn(async () => root) }, { maxWriteBytes: 16 });

    await expect(adapter.writeFile("/workspace/../secret.tsx", complexEffectSource)).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ESECURITY",
      path: "/workspace/../secret.tsx",
    });
    await expect(adapter.writeFile("/workspace/src/effect-app.tsx", complexEffectSource)).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "EFBIG",
      path: "/workspace/src/effect-app.tsx",
    });
    expect(root.createdWritableCount()).toBe(0);
  });
});

type MockFileHandle = ReturnType<typeof fileHandle>;
type MockDirectoryHandle = ReturnType<typeof directoryHandle>;
type MockHandle = MockFileHandle | MockDirectoryHandle;

function fileHandle(name: string, initialContent = "") {
  let content = initialContent;
  let writableCount = 0;
  return {
    kind: "file" as const,
    name,
    async getFile() {
      return { async text() { return content; } };
    },
    async createWritable() {
      writableCount += 1;
      return {
        async write(nextContent: string) {
          content = nextContent;
        },
        async close() {},
      };
    },
    createdWritableCount() {
      return writableCount;
    },
  };
}

function directoryHandle(name: string, initialChildren: Record<string, MockHandle>) {
  const children = new Map<string, MockHandle>(Object.entries(initialChildren));
  return {
    kind: "directory" as const,
    name,
    async getFileHandle(childName: string, options: { create?: boolean } = {}) {
      const existing = children.get(childName);
      if (existing?.kind === "file") return existing;
      if (existing && existing.kind !== "file") throw new Error(`Not a file: ${childName}`);
      if (!options.create) throw new Error(`Missing file: ${childName}`);
      const created = fileHandle(childName);
      children.set(childName, created);
      return created;
    },
    async getDirectoryHandle(childName: string, options: { create?: boolean } = {}) {
      const existing = children.get(childName);
      if (existing?.kind === "directory") return existing;
      if (existing && existing.kind !== "directory") throw new Error(`Not a directory: ${childName}`);
      if (!options.create) throw new Error(`Missing directory: ${childName}`);
      const created = directoryHandle(childName, {});
      children.set(childName, created);
      return created;
    },
    async *entries() {
      for (const entry of children.entries()) yield entry;
    },
    createdWritableCount(): number {
      return [...children.values()].reduce((count, child) => count + child.createdWritableCount(), 0);
    },
  };
}
