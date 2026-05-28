export type EffectDevToolsEventType = "fiber" | "span" | "metric";

export interface EffectDevToolsEvent {
  type: EffectDevToolsEventType;
  name: string;
  status?: string;
  value?: unknown;
  attributes?: Record<string, unknown>;
}

export interface DevToolsRequestHeaders {
  origin?: string;
  host?: string;
}

export interface OpenEffectDevToolsOptions {
  enabled: boolean;
  token: string;
  url?: string;
  maxEvents?: number;
  maxFrameBytes?: number;
  webSocketFactory?: (url: string) => WebSocket;
}

const allowedHosts = new Set(["127.0.0.1:34437", "localhost:34437"]);
const allowedOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const defaultUrl = "ws://127.0.0.1:34437";
const defaultMaxEvents = 200;
const defaultMaxFrameBytes = 64 * 1024;
const maxEventsPerSecond = 50;

export function isAllowedDevToolsUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "ws:" && allowedHosts.has(url.host) && url.pathname === "/";
  } catch {
    return false;
  }
}

export function isAllowedDevToolsRequest(headers: DevToolsRequestHeaders): boolean {
  return Boolean(headers.origin && headers.host && allowedOrigins.has(headers.origin) && allowedHosts.has(headers.host));
}

export function parseDevToolsEvent(raw: string, maxFrameBytes = defaultMaxFrameBytes): EffectDevToolsEvent | undefined {
  if (new TextEncoder().encode(raw).byteLength > maxFrameBytes) {
    return undefined;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || !isDevToolsEventType(parsed.type) || typeof parsed.name !== "string") {
    return undefined;
  }

  return {
    type: parsed.type,
    name: parsed.name,
    status: typeof parsed.status === "string" ? parsed.status : undefined,
    value: parsed.value,
    attributes: isRecord(parsed.attributes) ? parsed.attributes : undefined,
  };
}

export function boundedDevToolsEvents(
  events: readonly EffectDevToolsEvent[],
  next: EffectDevToolsEvent,
  maxEvents = defaultMaxEvents,
): EffectDevToolsEvent[] {
  return [...events, next].slice(-Math.max(1, maxEvents));
}

export function devToolsEventLabel(event: EffectDevToolsEvent): string {
  const suffixes = [event.status, event.value === undefined ? undefined : String(event.value), attributesLabel(event.attributes)]
    .filter((part): part is string => Boolean(part && part.length > 0));

  return suffixes.length > 0 ? `${event.type}: ${event.name} — ${suffixes.join(" — ")}` : `${event.type}: ${event.name}`;
}

export function openEffectDevToolsPanel(options: OpenEffectDevToolsOptions): void {
  const panel = ensurePanel();
  const list = panel.querySelector<HTMLDivElement>(".maldives-effect-devtools-events");
  const status = panel.querySelector<HTMLDivElement>(".maldives-effect-devtools-status");

  if (!list || !status) {
    return;
  }

  list.replaceChildren();

  if (!options.enabled) {
    setStatus(status, "DevTools disabled. Set MALDIVES_DEVTOOLS=1 to enable the localhost bridge.");
    return;
  }

  if (!options.token) {
    setStatus(status, "DevTools token required. Store it in ~/.config/maldives/devtools.token with mode 0600.");
    return;
  }

  const url = options.url ?? defaultUrl;

  if (!isAllowedDevToolsUrl(url)) {
    setStatus(status, "Rejected DevTools endpoint. Only ws://127.0.0.1:34437 or ws://localhost:34437 is allowed.");
    return;
  }

  setStatus(status, "Connecting to local Effect DevTools…");
  const socket = (options.webSocketFactory ?? ((socketUrl) => new WebSocket(socketUrl)))(url);
  const maxEvents = options.maxEvents ?? defaultMaxEvents;
  const maxFrameBytes = options.maxFrameBytes ?? defaultMaxFrameBytes;
  let events: EffectDevToolsEvent[] = [];
  let windowStartedAt = Date.now();
  let eventsInWindow = 0;

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "auth", token: options.token }));
    setStatus(status, "Connected to 127.0.0.1:34437 — never enable this against production secrets.");
  });

  socket.addEventListener("message", (message) => {
    if (typeof message.data !== "string" || rateLimited()) {
      return;
    }

    const event = parseDevToolsEvent(message.data, maxFrameBytes);

    if (!event) {
      return;
    }

    events = boundedDevToolsEvents(events, event, maxEvents);
    renderEvents(list, events);
  });

  socket.addEventListener("error", () => setStatus(status, "DevTools connection failed."));
  socket.addEventListener("close", () => setStatus(status, "DevTools disconnected."));

  function rateLimited(): boolean {
    const now = Date.now();

    if (now - windowStartedAt >= 1000) {
      windowStartedAt = now;
      eventsInWindow = 0;
    }

    eventsInWindow += 1;
    return eventsInWindow > maxEventsPerSecond;
  }
}

export function installEffectDevToolsButton(container: HTMLElement, options: Omit<OpenEffectDevToolsOptions, "enabled"> & { enabled?: boolean }): void {
  if (!options.enabled || container.querySelector(".maldives-effect-devtools-button")) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "maldives-effect-devtools-button";
  button.textContent = "Effect DevTools";
  button.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:10001",
    "background:#0e639c",
    "color:#fff",
    "border:0",
    "border-radius:4px",
    "padding:8px 10px",
    "font:12px system-ui,sans-serif",
  ].join(";");
  button.addEventListener("click", () => openEffectDevToolsPanel({ ...options, enabled: true }));
  container.append(button);
}

function ensurePanel(): HTMLDivElement {
  const existing = document.querySelector<HTMLDivElement>(".maldives-effect-devtools");

  if (existing) {
    return existing;
  }

  const panel = document.createElement("div");
  panel.className = "maldives-effect-devtools";
  panel.setAttribute("role", "complementary");
  panel.setAttribute("aria-label", "Effect DevTools");
  panel.style.cssText = [
    "position:fixed",
    "top:0",
    "right:0",
    "bottom:0",
    "z-index:10000",
    "width:min(380px, 40vw)",
    "background:#1e1e1e",
    "color:#d4d4d4",
    "border-left:1px solid #454545",
    "box-shadow:-12px 0 32px rgba(0,0,0,.35)",
    "font:12px system-ui,sans-serif",
    "overflow:auto",
  ].join(";");

  const heading = document.createElement("h2");
  heading.textContent = "Effect DevTools";
  heading.style.cssText = "margin:0;padding:12px;border-bottom:1px solid #333;font-size:14px";

  const warning = document.createElement("p");
  warning.textContent = "Local-only bridge. Never enable against a process holding production secrets; spans may leak attribute values.";
  warning.style.cssText = "margin:0;padding:10px 12px;color:#f0c674;border-bottom:1px solid #333";

  const status = document.createElement("div");
  status.className = "maldives-effect-devtools-status";
  status.style.cssText = "padding:10px 12px;color:#9cdcfe;border-bottom:1px solid #333";

  const list = document.createElement("div");
  list.className = "maldives-effect-devtools-events";

  panel.append(heading, warning, status, list);
  document.body.append(panel);
  return panel;
}

function renderEvents(list: HTMLDivElement, events: readonly EffectDevToolsEvent[]): void {
  list.replaceChildren();

  for (const event of events) {
    const row = document.createElement("div");
    row.className = `maldives-effect-devtools-event maldives-effect-devtools-event-${event.type}`;
    row.style.cssText = "padding:10px 12px;border-bottom:1px solid #2d2d2d;white-space:pre-wrap";
    row.textContent = devToolsEventLabel(event);
    list.append(row);
  }
}

function setStatus(status: HTMLDivElement, text: string): void {
  status.textContent = text;
}

function attributesLabel(attributes: Record<string, unknown> | undefined): string | undefined {
  if (!attributes) {
    return undefined;
  }

  return Object.entries(attributes)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDevToolsEventType(value: unknown): value is EffectDevToolsEventType {
  return value === "fiber" || value === "span" || value === "metric";
}
