import { describe, expect, test, vi } from "vitest";
import {
  FileSystemAccessAdapter,
  MemoryFileSystemAdapter,
  OpfsFileSystemAdapter,
  ProxyFileSystemAdapter,
  resolveFileSystemAdapter,
} from "../src/fs";

const complexEffectTsx = `
import { Effect, Layer, Schema, pipe } from "effect";

function Service(): ClassDecorator {
  return () => undefined;
}

@Service()
class Repository<A extends { id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  find(id: string) {
    return pipe(Effect.succeed({ id } as A), Effect.map((value) => value));
  }
}

export const LiveLayer = Layer.succeed("Repository", new Repository<{ id: string }>());
`;

describe("resolveFileSystemAdapter", () => {
  test("defaults to the Chromium File System Access adapter", () => {
    expect(resolveFileSystemAdapter()).toBeInstanceOf(FileSystemAccessAdapter);
    expect(resolveFileSystemAdapter("fsa")).toBeInstanceOf(FileSystemAccessAdapter);
  });

  test("uses a caller-supplied adapter unchanged", async () => {
    const adapter = new MemoryFileSystemAdapter({ "/src/repository.tsx": complexEffectTsx });

    expect(resolveFileSystemAdapter(adapter)).toBe(adapter);
    await expect(resolveFileSystemAdapter(adapter).readFile("/src/repository.tsx")).resolves.toContain("Effect.succeed");
  });

  test("constructs configured proxy and OPFS adapters", async () => {
    const fetch = vi.fn(async () => new Response(complexEffectTsx, { headers: { "content-type": "text/plain" } })) as unknown as typeof globalThis.fetch;
    const proxy = resolveFileSystemAdapter({ type: "proxy", origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });
    const opfs = resolveFileSystemAdapter("opfs");

    expect(proxy).toBeInstanceOf(ProxyFileSystemAdapter);
    await expect(proxy.readFile("/src/repository.tsx")).resolves.toContain("Layer.succeed");
    expect(opfs).toBeInstanceOf(OpfsFileSystemAdapter);
  });
});
