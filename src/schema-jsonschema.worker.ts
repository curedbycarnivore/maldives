import { generateJsonSchemaFromEffectSchemaSource, type WorkerRequest, type WorkerResponse } from "./schema-jsonschema";

installNoNetworkPolicy();

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { requestId, source, target } = event.data;

  try {
    const schema = generateJsonSchemaFromEffectSchemaSource(source, { target });
    self.postMessage({ requestId, ok: true, schema } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
});

function installNoNetworkPolicy(): void {
  const block = () => {
    throw new Error("Schema JSONSchema worker has connect-src 'none': network APIs are disabled.");
  };

  Object.defineProperty(globalThis, "fetch", { value: block, configurable: false });
  Object.defineProperty(globalThis, "WebSocket", { value: class NoNetworkWebSocket { constructor() { block(); } }, configurable: false });
  Object.defineProperty(globalThis, "EventSource", { value: class NoNetworkEventSource { constructor() { block(); } }, configurable: false });
}
