/**
 * Effect DevTools bridge security gates:
 * SG-P11D-1: opt-in only and bind 127.0.0.1, never 0.0.0.0.
 * SG-P11D-2: Origin + Host allowlist defends CSWSH and DNS rebinding.
 * SG-P11D-3: pre-shared token must come from a 0600 file and authenticate the first WebSocket frame.
 * SG-P11D-4: max-frame, bounded mailbox, and per-connection rate limits bound local DoS.
 * SG-P11D-5: wire event text is untrusted; the browser panel renders with textContent only.
 */
const { createHash, timingSafeEqual } = require("node:crypto");
const { readFile, stat } = require("node:fs/promises");
const { createServer } = require("node:http");
const { homedir } = require("node:os");
const { join } = require("node:path");
const { createInterface } = require("node:readline");

const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const defaultTokenFile = join(homedir(), ".config", "maldives", "devtools.token");
const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

async function startEffectDevToolsBridge(options = {}) {
  const enabled = options.enabled ?? process.env.MALDIVES_DEVTOOLS === "1";

  if (!enabled) {
    throw new Error("Effect DevTools bridge is disabled; set MALDIVES_DEVTOOLS=1 to enable it.");
  }

  if (options.host && options.host !== "127.0.0.1") {
    throw new Error("Effect DevTools bridge must bind 127.0.0.1 only.");
  }

  const token = await readToken(options.tokenFile ?? defaultTokenFile);
  const host = "127.0.0.1";
  const port = options.port ?? 34437;
  const maxFrameBytes = options.maxFrameBytes ?? 64 * 1024;
  const maxEventsPerSecond = options.maxEventsPerSecond ?? 50;
  const authenticated = new Set();
  const sockets = new Set();
  const mailbox = [];
  const maxMailboxEvents = 200;
  const server = createServer();

  server.on("upgrade", (request, socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));

    const actualPort = addressOf(server).port;

    if (!isAllowedRequest(request, actualPort)) {
      debug(`reject handshake origin=${String(request.headers.origin)} host=${String(request.headers.host)} url=${String(request.url)}`);
      reject(socket, "403 Forbidden");
      return;
    }

    const key = request.headers["sec-websocket-key"];

    if (typeof key !== "string") {
      reject(socket, "400 Bad Request");
      return;
    }

    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${createAcceptKey(key)}`,
        "\r\n",
      ].join("\r\n"),
    );

    let authBuffer = Buffer.alloc(0);
    const authTimeout = setTimeout(() => socket.end(), 2000);
    const finishAuth = () => {
      clearTimeout(authTimeout);
      socket.off("data", onAuthData);
    };
    const onAuthData = (buffer) => {
      authBuffer = Buffer.concat([authBuffer, buffer]);

      if (authBuffer.byteLength > maxFrameBytes) {
        finishAuth();
        socket.end();
        return;
      }

      const text = decodeClientTextFrame(authBuffer);

      if (text === undefined) {
        return;
      }

      finishAuth();

      if (!isAuthenticatedText(text, token)) {
        debug("reject auth frame");
        socket.end();
        return;
      }

      const client = { socket, windowStartedAt: Date.now(), eventsInWindow: 0 };
      authenticated.add(client);
      socket.on("close", () => authenticated.delete(client));
      for (const event of mailbox) {
        sendSerializedEvent(client, JSON.stringify(event), maxEventsPerSecond);
      }
    };

    socket.on("data", onAuthData);
  });

  await listen(server, port, host);

  return {
    address: addressOf(server),
    publish(event) {
      if (!isEffectDevToolsEvent(event)) {
        return false;
      }

      const serialized = JSON.stringify(event);
      if (Buffer.byteLength(serialized, "utf8") > maxFrameBytes) {
        return false;
      }

      mailbox.push(event);
      if (mailbox.length > maxMailboxEvents) {
        mailbox.splice(0, mailbox.length - maxMailboxEvents);
      }

      for (const client of authenticated) {
        sendSerializedEvent(client, serialized, maxEventsPerSecond);
      }
      return true;
    },
    clientCount: () => authenticated.size,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolve());
      }),
  };
}

async function readToken(path) {
  const info = await stat(path);
  const mode = info.mode & 0o777;

  if (process.platform !== "win32" && mode !== 0o600) {
    throw new Error(`Effect DevTools token file must be mode 0600: ${path}`);
  }

  const token = (await readFile(path, "utf8")).trim();

  if (!token) {
    throw new Error(`Effect DevTools token file is empty: ${path}`);
  }

  return token;
}

function isAllowedRequest(request, port) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  return request.url === "/" && typeof origin === "string" && typeof host === "string" && allowedOrigins.has(origin) && allowedHosts.has(host);
}

function isAuthenticatedText(text, expectedToken) {
  try {
    const parsed = JSON.parse(text);

    return parsed.type === "auth" && typeof parsed.token === "string" && safeEqual(parsed.token, expectedToken);
  } catch {
    return false;
  }
}

function safeEqual(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  return valueBuffer.byteLength === expectedBuffer.byteLength && timingSafeEqual(valueBuffer, expectedBuffer);
}

function decodeClientTextFrame(buffer) {
  if (buffer.byteLength < 6 || (buffer[0] & 0x0f) !== 0x1 || (buffer[1] & 0x80) === 0) {
    return undefined;
  }

  const lengthByte = buffer[1] & 0x7f;
  let length = lengthByte;
  let maskOffset = 2;

  if (lengthByte === 126) {
    if (buffer.byteLength < 8) return undefined;
    length = buffer.readUInt16BE(2);
    maskOffset = 4;
  } else if (lengthByte === 127) {
    return undefined;
  }

  const payloadOffset = maskOffset + 4;

  if (buffer.byteLength < payloadOffset + length) {
    return undefined;
  }

  const mask = buffer.subarray(maskOffset, payloadOffset);
  const payload = buffer.subarray(payloadOffset, payloadOffset + length);

  return Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4])).toString("utf8");
}

function encodeServerTextFrame(text) {
  const payload = Buffer.from(text, "utf8");

  if (payload.byteLength < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.byteLength]), payload]);
  }

  if (payload.byteLength <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.byteLength, 2);
    return Buffer.concat([header, payload]);
  }

  throw new Error("Effect DevTools frame exceeds 65535 bytes");
}

function createAcceptKey(key) {
  return createHash("sha1").update(`${key}${websocketGuid}`).digest("base64");
}

function reject(socket, status) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function listen(server, port, host) {
  return new Promise((resolve, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      server.off("error", rejectPromise);
      resolve();
    });
  });
}

function addressOf(server) {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Effect DevTools bridge address is unavailable");
  }

  return { address: address.address, port: address.port };
}

function sendSerializedEvent(client, serialized, maxEventsPerSecond) {
  if (!rateLimited(client, maxEventsPerSecond)) {
    client.socket.write(encodeServerTextFrame(serialized));
  }
}

function rateLimited(client, maxEventsPerSecond) {
  const now = Date.now();

  if (now - client.windowStartedAt >= 1000) {
    client.windowStartedAt = now;
    client.eventsInWindow = 0;
  }

  client.eventsInWindow += 1;
  return client.eventsInWindow > maxEventsPerSecond;
}

function debug(message) {
  if (process.env.MALDIVES_DEVTOOLS_DEBUG === "1") {
    console.error(`[maldives-devtools] ${message}`);
  }
}

function isEffectDevToolsEvent(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value.type === "fiber" || value.type === "span" || value.type === "metric") &&
      typeof value.name === "string",
  );
}

async function runBridgeCli() {
  const bridge = await startEffectDevToolsBridge({
    tokenFile: process.env.MALDIVES_DEVTOOLS_TOKEN_FILE,
    port: process.env.MALDIVES_DEVTOOLS_PORT ? Number(process.env.MALDIVES_DEVTOOLS_PORT) : undefined,
  });
  console.log(`Effect DevTools bridge listening on ws://${bridge.address.address}:${bridge.address.port}`);

  const lines = createInterface({ input: process.stdin });

  lines.on("line", (line) => {
    try {
      bridge.publish(JSON.parse(line));
    } catch {
      debug("ignore malformed producer line");
    }
  });
}

if (require.main === module) {
  void runBridgeCli();
}

module.exports = { startEffectDevToolsBridge };
