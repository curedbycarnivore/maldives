import { describe, expect, test, vi } from "vitest";
import { FileSystemAccessAdapter, fileUriForFsaPath, openPickedFileInWorkspace } from "../src/fs/fsa-adapter";

const complexEffectSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function injectable(_: unknown, _context: ClassDecoratorContext) {}

@injectable
class AuditRepository<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String, value: Schema.Number });

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(this.schema)({ id, value: 1 });
      return { ...parsed, seed: id } satisfies A & { readonly seed: string };
    }.bind(this));
  }
}

const AuditRepo = Context.GenericTag<AuditRepository<{ readonly id: string }>>("AuditRepository");
export const AuditRepoLive = Layer.succeed(AuditRepo, new AuditRepository({ id: "seed" }));
export const program = pipe(Effect.succeed("42"), Effect.flatMap((id) => new AuditRepository({ id }).load(id)));
`;

describe("FileSystemAccessAdapter", () => {
  test("opens a real browser file handle, caches it by path, and opens it in a workspace tab", async () => {
    const host = {
      showOpenFilePicker: vi.fn(async () => [fileHandle("effect-app.tsx", complexEffectSource)]),
    };
    const adapter = new FileSystemAccessAdapter(host);
    const workspace = { open: vi.fn() };

    const picked = await adapter.openFile();
    const contentFromCache = await adapter.readFile("/effect-app.tsx");
    const opened = await openPickedFileInWorkspace(adapter, workspace);

    expect(picked).toEqual({ path: "/effect-app.tsx", content: complexEffectSource });
    expect(contentFromCache).toBe(complexEffectSource);
    expect(opened).toEqual({ path: "/effect-app.tsx", uri: "file:///effect-app.tsx", content: complexEffectSource });
    expect(workspace.open).toHaveBeenCalledWith("file:///effect-app.tsx", complexEffectSource);
    expect(host.showOpenFilePicker).toHaveBeenCalledTimes(2);
    expect(fileUriForFsaPath("workspace/src/effect-app.tsx")).toBe("file:///workspace/src/effect-app.tsx");
  });

  test("lists direct children from a granted browser directory handle and reads listed files", async () => {
    const host = {
      showDirectoryPicker: vi.fn(async () =>
        directoryHandle("workspace", {
          "README.md": fileHandle("README.md", "# Maldives\n"),
          src: directoryHandle("src", {
            "effect-app.tsx": fileHandle("effect-app.tsx", complexEffectSource),
          }),
        }),
      ),
    };
    const adapter = new FileSystemAccessAdapter(host);

    await expect(adapter.list("/workspace")).resolves.toEqual([
      { type: "file", name: "README.md", path: "/workspace/README.md" },
      { type: "directory", name: "src", path: "/workspace/src" },
    ]);
    await expect(adapter.list("/workspace/src")).resolves.toEqual([
      { type: "file", name: "effect-app.tsx", path: "/workspace/src/effect-app.tsx" },
    ]);
    await expect(adapter.readFile("/workspace/src/effect-app.tsx")).resolves.toBe(complexEffectSource);
    expect(host.showDirectoryPicker).toHaveBeenCalledTimes(1);
  });
});

function fileHandle(name: string, content: string) {
  return {
    kind: "file",
    name,
    async getFile() {
      return { async text() { return content; } };
    },
  };
}

function directoryHandle(name: string, children: Record<string, ReturnType<typeof fileHandle> | ReturnType<typeof directoryHandle>>) {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const [childName, handle] of Object.entries(children)) {
        yield [childName, handle] as const;
      }
    },
  };
}
