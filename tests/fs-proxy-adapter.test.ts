import { describe, expect, test, vi } from "vitest";
import { FileSystemAdapterError, ProxyFileSystemAdapter } from "../src/fs";

const complexEffectSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function injectable(_: unknown, _context: ClassDecoratorContext) {}

@injectable
class Take5Repository<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String, value: Schema.Number });

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(this.schema)({ id, value: 1 });
      return { ...parsed, seed: id } satisfies A & { readonly seed: string };
    }.bind(this));
  }
}

const Take5Repo = Context.GenericTag<Take5Repository<{ readonly id: string }>>("Take5Repository");
export const Take5RepoLive = Layer.succeed(Take5Repo, new Take5Repository({ id: "seed" }));
export const program = pipe(Effect.succeed("42"), Effect.flatMap((id) => new Take5Repository({ id }).load(id)));
`;

describe("ProxyFileSystemAdapter", () => {
  test("reads, lists, and writes through the Take5 workspace API with session credentials and token", async () => {
    const requests: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = input.toString();
      requests.push({ url, init });

      if (url === "https://take5.local/workspace/maldives/src/effect-app.tsx" && init.method === "GET") {
        return response(complexEffectSource, { headers: { "content-type": "text/plain" } });
      }

      if (url === "https://take5.local/workspace/maldives/src?list=1" && init.method === "GET") {
        return response(JSON.stringify([{ type: "file", name: "effect-app.tsx", path: "/src/effect-app.tsx" }]), {
          headers: { "content-type": "application/json" },
        });
      }

      if (url === "https://take5.local/workspace/maldives/src/effect-app.tsx" && init.method === "PUT") {
        expect(init.body).toBe(`${complexEffectSource}\nexport const saved = true;\n`);
        return response("");
      }

      return response("not found", { status: 404 });
    });
    const adapter = new ProxyFileSystemAdapter({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });
    const watcher = vi.fn();
    const subscription = adapter.watch("/src", watcher);

    await expect(adapter.readFile("/src/effect-app.tsx")).resolves.toBe(complexEffectSource);
    await expect(adapter.list("/src")).resolves.toEqual([{ type: "file", name: "effect-app.tsx", path: "/src/effect-app.tsx" }]);
    await adapter.writeFile("/src/effect-app.tsx", `${complexEffectSource}\nexport const saved = true;\n`);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(requests.map((request) => request.init.credentials)).toEqual(["same-origin", "same-origin", "same-origin"]);
    expect(requests.map((request) => (request.init.headers as Record<string, string>)["x-maldives-workspace-token"])).toEqual([
      "session-token",
      "session-token",
      "session-token",
    ]);
    expect(requests[2]?.init.headers).toMatchObject({ "content-type": "text/plain; charset=utf-8" });
    expect(watcher).toHaveBeenCalledWith({ type: "write", path: "/src/effect-app.tsx" });

    subscription.dispose();
  });

  test("rejects traversal and malformed repo paths before fetch", async () => {
    const fetch = vi.fn();
    const adapter = new ProxyFileSystemAdapter({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });

    await expect(adapter.readFile("/src/../secret.tsx")).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ESECURITY",
      path: "/src/../secret.tsx",
    });
    expect(() => new ProxyFileSystemAdapter({ origin: "https://take5.local", repo: "../maldives", token: "session-token", fetch })).toThrow(
      FileSystemAdapterError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("maps Take5 HTTP failures to typed adapter errors", async () => {
    const fetch = vi.fn(async () => response("too large", { status: 413 }));
    const adapter = new ProxyFileSystemAdapter({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });

    await expect(adapter.writeFile("/src/effect-app.tsx", complexEffectSource)).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "EFBIG",
      path: "/src/effect-app.tsx",
    });
  });

  test("enforces HTTPS origin and client-side write size before fetch", async () => {
    const fetch = vi.fn(async () => response(""));

    expect(() => new ProxyFileSystemAdapter({ origin: "http://take5.local", repo: "maldives", token: "session-token", fetch })).toThrow(
      FileSystemAdapterError,
    );

    const adapter = new ProxyFileSystemAdapter({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch, maxWriteBytes: 16 });

    await expect(adapter.writeFile("/src/effect-app.tsx", "x".repeat(17))).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "EFBIG",
      path: "/src/effect-app.tsx",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("trusts only textual read responses and JSON list responses inside the requested workspace path", async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = input.toString();

      if (url.endsWith("/src/effect-app.tsx") && init.method === "GET") {
        return response("<script>not source</script>", { headers: { "content-type": "text/html" } });
      }

      if (url.endsWith("/src?list=1") && init.method === "GET") {
        return response(JSON.stringify([{ type: "file", name: "secret.tsx", path: "/secret.tsx" }]), {
          headers: { "content-type": "application/json" },
        });
      }

      return response("not found", { status: 404 });
    });
    const adapter = new ProxyFileSystemAdapter({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });

    await expect(adapter.readFile("/src/effect-app.tsx")).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ESECURITY",
      path: "/src/effect-app.tsx",
    });
    await expect(adapter.list("/src")).rejects.toMatchObject({
      name: "FileSystemAdapterError",
      code: "ESECURITY",
      path: "/secret.tsx",
    });
  });
});

function response(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: init.status ?? 200, headers: init.headers });
}
