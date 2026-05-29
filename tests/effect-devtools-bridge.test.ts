import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import bridgeModule from "../scripts/effect-devtools-bridge.cjs";

const { startEffectDevToolsBridge } = bridgeModule as {
  startEffectDevToolsBridge: (options: {
    enabled?: boolean;
    tokenFile?: string;
    port?: number;
    maxFrameBytes?: number;
  }) => Promise<{
    address: { address: string; port: number };
    publish: (event: { type: "fiber" | "span" | "metric"; name: string; status?: string; attributes?: Record<string, unknown> }) => boolean;
    clientCount: () => number;
    close: () => Promise<void>;
  }>;
};

const sockets = new Set<Socket>();
let cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await Promise.all(cleanup.map((fn) => fn()));
  cleanup = [];
});

describe("Effect DevTools localhost bridge", () => {
  test("requires opt-in, a 0600 token file, and binds to localhost", async () => {
    const tokenFile = await writeTokenFile("secret-token", 0o600);
    const looseTokenFile = await writeTokenFile("secret-token", 0o644);

    // SG-P11D-1: disabled unless explicitly opted in.
    await expect(startEffectDevToolsBridge({ tokenFile, port: 0, enabled: false })).rejects.toThrow(/MALDIVES_DEVTOOLS=1/);
    // SG-P11D-3: token file permissions must be owner-read/write only.
    await expect(startEffectDevToolsBridge({ tokenFile: looseTokenFile, port: 0, enabled: true })).rejects.toThrow(/mode 0600/);
    // SG-P11D-1: localhost bind is not configurable to 0.0.0.0.
    await expect(startEffectDevToolsBridge({ tokenFile, host: "0.0.0.0", port: 0, enabled: true } as never)).rejects.toThrow(/127\.0\.0\.1/);

    const bridge = await startEffectDevToolsBridge({ tokenFile, port: 0, enabled: true });
    cleanup.push(() => bridge.close());

    expect(bridge.address.address).toBe("127.0.0.1");
    expect(bridge.address.port).toBeGreaterThan(0);
  });

  test("rejects missing tokens, hostile origins, and bad Host headers on a real socket", async () => {
    const tokenFile = await writeTokenFile("secret-token", 0o600);
    const bridge = await startEffectDevToolsBridge({ tokenFile, port: 0, enabled: true });
    cleanup.push(() => bridge.close());

    const host = `127.0.0.1:${bridge.address.port}`;

    // SG-P11D-2: reject hostile Origin and DNS-rebound Host headers.
    await expect(handshake(bridge.address.port, "https://evil.test", host)).resolves.toContain("403 Forbidden");
    await expect(handshake(bridge.address.port, "http://127.0.0.1:5173", "evil.test:34437")).resolves.toContain("403 Forbidden");

    // SG-P11D-3: first WebSocket frame must carry the pre-shared token.
    const missingToken = await openAuthenticatedSocket(bridge.address.port, "http://127.0.0.1:5173", host, "wrong-token");
    await expect(waitForClose(missingToken)).resolves.toBe(true);
  });

  test("streams authenticated Effect events from the real bridge", async () => {
    const tokenFile = await writeTokenFile("secret-token", 0o600);
    const bridge = await startEffectDevToolsBridge({ tokenFile, port: 0, enabled: true, maxFrameBytes: 128 });
    cleanup.push(() => bridge.close());

    const socket = await openAuthenticatedSocket(
      bridge.address.port,
      "http://127.0.0.1:5173",
      `127.0.0.1:${bridge.address.port}`,
      "secret-token",
    );

    await waitFor(() => bridge.clientCount() === 1);
    // SG-P11D-4: oversized published events are rejected before framing.
    expect(bridge.publish({ type: "span", name: "x".repeat(200), status: "too-large" })).toBe(false);
    // SG-P11D-4: authenticated clients receive bounded, rate-limited bridge events.
    expect(bridge.publish({ type: "span", name: "real-bridge-span", status: "completed", attributes: { route: "Effect.gen" } })).toBe(true);

    await expect(readServerTextFrame(socket)).resolves.toContain("real-bridge-span");
  });
});

async function writeTokenFile(token: string, mode: number): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "maldives-devtools-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const tokenFile = join(dir, "devtools.token");
  await writeFile(tokenFile, token, "utf8");
  await chmod(tokenFile, mode);
  return tokenFile;
}

async function handshake(port: number, origin: string, host: string): Promise<string> {
  const socket = await connect(port);
  const key = "dGhlIHNhbXBsZSBub25jZQ==";
  socket.write([
    "GET / HTTP/1.1",
    `Host: ${host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Origin: ${origin}`,
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "\r\n",
  ].join("\r\n"));
  return await readChunk(socket);
}

async function openAuthenticatedSocket(port: number, origin: string, host: string, token: string): Promise<Socket> {
  const socket = await connect(port);
  const response = await handshakeOnSocket(socket, origin, host);
  expect(response).toContain("101 Switching Protocols");
  socket.write(encodeClientTextFrame(JSON.stringify({ type: "auth", token })));
  return socket;
}

async function handshakeOnSocket(socket: Socket, origin: string, host: string): Promise<string> {
  const key = "dGhlIHNhbXBsZSBub25jZQ==";
  socket.write([
    "GET / HTTP/1.1",
    `Host: ${host}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Origin: ${origin}`,
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "\r\n",
  ].join("\r\n"));
  return await readChunk(socket);
}

function connect(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    sockets.add(socket);
    socket.once("error", reject);
    socket.connect(port, "127.0.0.1", () => {
      socket.off("error", reject);
      resolve(socket);
    });
  });
}

function readChunk(socket: Socket): Promise<string> {
  return new Promise((resolve) => socket.once("data", (chunk) => resolve(chunk.toString("utf8"))));
}

function waitForClose(socket: Socket): Promise<boolean> {
  return new Promise((resolve) => {
    socket.once("close", () => resolve(true));
    setTimeout(() => resolve(false), 1000);
  });
}

async function readServerTextFrame(socket: Socket): Promise<string> {
  const chunk = await new Promise<Buffer>((resolve) => socket.once("data", resolve));
  const length = chunk[1] & 0x7f;
  const payloadOffset = length === 126 ? 4 : 2;
  const payloadLength = length === 126 ? chunk.readUInt16BE(2) : length;
  return chunk.subarray(payloadOffset, payloadOffset + payloadLength).toString("utf8");
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const started = Date.now();

  while (!predicate()) {
    if (Date.now() - started > 1000) {
      throw new Error("Timed out waiting for bridge condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function encodeClientTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const mask = Buffer.from([1, 2, 3, 4]);
  const header = Buffer.from([0x81, 0x80 | payload.length]);
  const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
  return Buffer.concat([header, mask, masked]);
}
