import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const DEVTOOLS_TOKEN = "test-devtools-token";

function websocketAcceptKey(key: string): string {
  return createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function decodeClientTextFrame(buffer: Buffer): string {
  const length = buffer[1] & 0x7f;
  const maskOffset = 2;
  const payloadOffset = maskOffset + 4;
  const mask = buffer.subarray(maskOffset, payloadOffset);
  const payload = buffer.subarray(payloadOffset, payloadOffset + length);

  return Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4])).toString("utf8");
}

function encodeServerTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");

  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }

  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);

  return Buffer.concat([header, payload]);
}

async function startDevToolsFixture(): Promise<{ close: () => Promise<void> }> {
  const server = createServer();
  const sockets = new Set<Socket>();

  server.on("upgrade", (request: IncomingMessage, socket: Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    const origin = request.headers.origin;
    const host = request.headers.host;

    if (origin !== "http://127.0.0.1:5173" || (host !== "127.0.0.1:34437" && host !== "localhost:34437")) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    const key = request.headers["sec-websocket-key"];

    if (typeof key !== "string") {
      socket.destroy();
      return;
    }

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${websocketAcceptKey(key)}`,
        "\r\n",
      ].join("\r\n"),
    );

    socket.once("data", (buffer) => {
      const auth = JSON.parse(decodeClientTextFrame(buffer)) as { token?: string };

      if (auth.token !== DEVTOOLS_TOKEN) {
        socket.end();
        return;
      }

      socket.write(
        encodeServerTextFrame(
          JSON.stringify({
            type: "span",
            name: "maldives-test-span",
            status: "completed",
            attributes: { route: "Effect.gen", unsafe: "<script>alert(1)</script>" },
          }),
        ),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(34437, "127.0.0.1", resolve));

  return {
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  };
}

test("Effect DevTools panel streams a local span and rejects cross-origin sockets", async ({ browser, page }) => {
  const fixture = await startDevToolsFixture();

  try {
    await loadEditor(page);

    await page.evaluate((token) => {
      window.__maldivesOpenEffectDevTools({
        enabled: true,
        token,
        url: "ws://127.0.0.1:34437",
      });
    }, DEVTOOLS_TOKEN);

    await page.locator(".maldives-effect-devtools").waitFor({ state: "visible", timeout: 8000 });
    await expect(page.locator(".maldives-effect-devtools")).toContainText("maldives-test-span", { timeout: 8000 });
    await expect(page.locator(".maldives-effect-devtools")).toContainText("Effect.gen");
    await expect(page.locator(".maldives-effect-devtools")).toContainText("<script>alert(1)</script>");
    await expect(page.locator(".maldives-effect-devtools script")).toHaveCount(0);

    const hostile = await browser.newPage();
    await hostile.goto("data:text/html,<title>hostile</title>");
    const rejected = await hostile.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const ws = new WebSocket("ws://127.0.0.1:34437");
          ws.onopen = () => resolve(false);
          ws.onerror = () => resolve(true);
          ws.onclose = () => resolve(true);
          setTimeout(() => resolve(false), 2000);
        }),
    );
    await hostile.close();

    expect(rejected).toBe(true);

    await mkdir("proof", { recursive: true });
    await page.screenshot({ path: "proof/p11d-effect-devtools-panel-proof.png" });
  } finally {
    await fixture.close();
  }
});
