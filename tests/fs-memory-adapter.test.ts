import { describe, expect, test, vi } from "vitest";
import { MemoryFileSystemAdapter } from "../src/fs/memory-adapter";

const complexEffectSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function sealed(_: unknown, _context: ClassDecoratorContext) {}

@sealed
class UserRepository<A extends { readonly id: string }> {
  constructor(readonly seed: A) {}

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))({ id });
      return { ...parsed, seed: this.seed };
    }.bind(this));
  }
}

export const UserRepoLive = Layer.succeed(
  Context.GenericTag<UserRepository<{ readonly id: string }>>("UserRepository"),
  new UserRepository({ id: "seed" }),
);

export const program = pipe(
  Effect.succeed("/workspace/src/app.tsx"),
  Effect.flatMap((id) => new UserRepository({ id }).load(id)),
);
`;

describe("MemoryFileSystemAdapter", () => {
  test("round-trips complex TSX content, lists direct children, and notifies watchers", async () => {
    const fs = new MemoryFileSystemAdapter({
      "/workspace/README.md": "# Maldives\n",
      "/workspace/src/existing.ts": "export const existing = true;\n",
    });
    const fileWatcher = vi.fn();
    const dirWatcher = vi.fn();

    const fileSubscription = fs.watch("/workspace/src/app.tsx", fileWatcher);
    const dirSubscription = fs.watch("/workspace/src", dirWatcher);

    await fs.writeFile("/workspace/src/app.tsx", complexEffectSource);

    expect(await fs.readFile("/workspace/src/app.tsx")).toBe(complexEffectSource);
    expect(await fs.list("/workspace")).toEqual([
      { type: "file", name: "README.md", path: "/workspace/README.md" },
      { type: "directory", name: "src", path: "/workspace/src" },
    ]);
    expect(await fs.list("/workspace/src")).toEqual([
      { type: "file", name: "app.tsx", path: "/workspace/src/app.tsx" },
      { type: "file", name: "existing.ts", path: "/workspace/src/existing.ts" },
    ]);
    expect(fileWatcher).toHaveBeenCalledWith({ type: "write", path: "/workspace/src/app.tsx" });
    expect(dirWatcher).toHaveBeenCalledWith({ type: "write", path: "/workspace/src/app.tsx" });

    fileSubscription.dispose();
    dirSubscription.dispose();
    await fs.writeFile("/workspace/src/app.tsx", `${complexEffectSource}\n// saved again\n`);

    expect(fileWatcher).toHaveBeenCalledTimes(1);
    expect(dirWatcher).toHaveBeenCalledTimes(1);
  });

  test("reports missing files through a typed adapter error", async () => {
    const fs = new MemoryFileSystemAdapter();

    await expect(fs.readFile("/workspace/missing.ts")).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ENOENT",
      path: "/workspace/missing.ts",
    });
  });
});
