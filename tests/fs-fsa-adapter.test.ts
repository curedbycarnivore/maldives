import { describe, expect, test, vi } from "vitest";
import { FileSystemAccessAdapter, fileUriForFsaPath, openPickedFileInWorkspace, saveWorkspaceFile } from "../src/fs/fsa-adapter";

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

  test("writes through the cached FSA handle only after readwrite permission and marks the workspace file clean", async () => {
    const handle = fileHandle("effect-app.tsx", complexEffectSource);
    const host = { showOpenFilePicker: vi.fn(async () => [handle]) };
    const adapter = new FileSystemAccessAdapter(host);
    const workspace = { markClean: vi.fn(() => true) };
    const savedSource = `${complexEffectSource}\nexport const saved = true;\n`;

    await adapter.openFile();
    await saveWorkspaceFile(adapter, workspace, "file:///effect-app.tsx", savedSource, { userGesture: true });

    await expect(adapter.readFile("/effect-app.tsx")).resolves.toBe(savedSource);
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(handle.createWritable).toHaveBeenCalledTimes(1);
    expect(handle.writable.write).toHaveBeenCalledWith(savedSource);
    expect(handle.writable.close).toHaveBeenCalledTimes(1);
    expect(workspace.markClean).toHaveBeenCalledWith("file:///effect-app.tsx");
  });

  test("rejects traversal paths before asking permission or opening a writable", async () => {
    const handle = fileHandle("effect-app.tsx", complexEffectSource);
    const adapter = new FileSystemAccessAdapter({ showOpenFilePicker: vi.fn(async () => [handle]) });

    await adapter.openFile();

    await expect(adapter.writeFile("/workspace/../outside.tsx", complexEffectSource, { userGesture: true })).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ESECURITY",
      path: "/workspace/../outside.tsx",
    });
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  test("requires a fresh user gesture for every FSA write", async () => {
    const handle = fileHandle("effect-app.tsx", complexEffectSource);
    const adapter = new FileSystemAccessAdapter({ showOpenFilePicker: vi.fn(async () => [handle]) });

    await adapter.openFile();
    await adapter.writeFile("/effect-app.tsx", `${complexEffectSource}\n// first save\n`, { userGesture: true });

    await expect(adapter.writeFile("/effect-app.tsx", `${complexEffectSource}\n// second save\n`)).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "EACCES",
      path: "/effect-app.tsx",
    });
    expect(handle.createWritable).toHaveBeenCalledTimes(1);
  });

  test("never writes outside the granted FSA directory scope", async () => {
    const known = fileHandle("effect-app.tsx", complexEffectSource);
    const host = {
      showDirectoryPicker: vi.fn(async () => directoryHandle("workspace", { "effect-app.tsx": known })),
    };
    const adapter = new FileSystemAccessAdapter(host);

    await adapter.list("/workspace");

    await expect(adapter.writeFile("/workspace/secret.tsx", complexEffectSource, { userGesture: true })).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ENOENT",
      path: "/workspace/secret.tsx",
    });
    expect(known.requestPermission).not.toHaveBeenCalled();
    expect(known.createWritable).not.toHaveBeenCalled();
  });

  test("rejects writes over the configured 5MB cap before opening a writable", async () => {
    const handle = fileHandle("effect-app.tsx", complexEffectSource);
    const adapter = new FileSystemAccessAdapter({ showOpenFilePicker: vi.fn(async () => [handle]) }, { maxWriteBytes: 32 });

    await adapter.openFile();

    await expect(adapter.writeFile("/effect-app.tsx", complexEffectSource, { userGesture: true })).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "EFBIG",
      path: "/effect-app.tsx",
    });
    expect(handle.requestPermission).not.toHaveBeenCalled();
    expect(handle.createWritable).not.toHaveBeenCalled();
  });
});

function fileHandle(name: string, initialContent: string) {
  let content = initialContent;
  const handle = {
    kind: "file" as const,
    name,
    writable: {
      write: vi.fn(async (nextContent: string) => {
        content = nextContent;
      }),
      close: vi.fn(async () => undefined),
    },
    requestPermission: vi.fn(async (_descriptor: { mode: "readwrite" }) => "granted" as const),
    createWritable: vi.fn(async () => handle.writable),
    async getFile() {
      return { async text() { return content; } };
    },
  };
  return handle;
}

type MockFileHandle = ReturnType<typeof fileHandle>;
type MockDirectoryHandle = ReturnType<typeof directoryHandle>;

function directoryHandle(name: string, children: Record<string, MockFileHandle | MockDirectoryHandle>) {
  return {
    kind: "directory" as const,
    name,
    async *entries() {
      for (const [childName, handle] of Object.entries(children)) {
        yield [childName, handle] as const;
      }
    },
  };
}
