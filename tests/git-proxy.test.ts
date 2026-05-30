import { describe, expect, test, vi } from "vitest";
import { FileSystemAdapterError } from "../src/fs";
import { Take5GitProxyClient } from "../src/git-proxy";

const statusPayload = [
  { path: "/src/effect-stress-app.tsx", status: "modified", lines: [180] },
  { path: "/src/new-service.ts", status: "added", lines: [1, 2] },
];
const blamePayload = {
  path: "/src/effect-stress-app.tsx",
  line: 180,
  author: "Ada Lovelace",
  commit: "abc1234",
  summary: "Wire real Effect repository",
};
const diffPayload = [
  {
    path: "/src/effect-stress-app.tsx",
    oldStart: 172,
    oldLines: 3,
    newStart: 172,
    newLines: 4,
    lines: ["@@ -172,3 +172,4 @@", " export const program = pipe(", "+  Effect.annotateLogs(\"git\", \"take5\"),"],
  },
];

describe("Take5GitProxyClient", () => {
  test("reads read-only status, blame, and diff from the Take5 git API with credentials and token", async () => {
    const requests: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = input.toString();
      requests.push({ url, init });

      if (url === "https://take5.local/workspace/maldives/git/status") {
        return json(statusPayload);
      }
      if (url === "https://take5.local/workspace/maldives/git/blame?path=%2Fsrc%2Feffect-stress-app.tsx&line=180") {
        return json(blamePayload);
      }
      if (url === "https://take5.local/workspace/maldives/git/diff?path=%2Fsrc%2Feffect-stress-app.tsx") {
        return json(diffPayload);
      }

      return new Response("not found", { status: 404 });
    });
    const client = new Take5GitProxyClient({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });

    await expect(client.status()).resolves.toEqual(statusPayload);
    await expect(client.blame("/src/effect-stress-app.tsx", 180)).resolves.toEqual(blamePayload);
    await expect(client.diff("/src/effect-stress-app.tsx")).resolves.toEqual(diffPayload);

    expect(requests.map((request) => request.init.credentials)).toEqual(["same-origin", "same-origin", "same-origin"]);
    expect(requests.map((request) => (request.init.headers as Record<string, string>)["x-maldives-workspace-token"])).toEqual([
      "session-token",
      "session-token",
      "session-token",
    ]);
  });

  test("rejects non-HTTPS origins and traversal paths before fetching", async () => {
    const fetch = vi.fn(async () => json({}));

    expect(() => new Take5GitProxyClient({ origin: "http://take5.local", repo: "maldives", token: "session-token", fetch })).toThrow(
      FileSystemAdapterError,
    );

    const client = new Take5GitProxyClient({ origin: "https://take5.local", repo: "maldives", token: "session-token", fetch });
    await expect(client.diff("/src/../secret.ts")).rejects.toMatchObject({ code: "ESECURITY", path: "/src/../secret.ts" });
    await expect(client.blame("/src/effect-stress-app.tsx", 0)).rejects.toMatchObject({ code: "EACCES" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
}
