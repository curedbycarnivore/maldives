import { describe, expect, test } from "vitest";
import {
  boundedDevToolsEvents,
  devToolsEventLabel,
  isAllowedDevToolsRequest,
  isAllowedDevToolsUrl,
  parseDevToolsEvent,
} from "../src/effect-devtools";

describe("Effect DevTools panel helpers", () => {
  test("accepts only localhost DevTools websocket endpoints", () => {
    expect(isAllowedDevToolsUrl("ws://127.0.0.1:34437")).toBe(true);
    expect(isAllowedDevToolsUrl("ws://localhost:34437")).toBe(true);
    expect(isAllowedDevToolsUrl("ws://0.0.0.0:34437")).toBe(false);
    expect(isAllowedDevToolsUrl("wss://localhost:34437")).toBe(false);
    expect(isAllowedDevToolsUrl("ws://localhost:9999")).toBe(false);
  });

  test("rejects cross-origin or DNS-rebound websocket handshakes", () => {
    expect(
      isAllowedDevToolsRequest({ origin: "http://127.0.0.1:5173", host: "127.0.0.1:34437" }),
    ).toBe(true);
    expect(isAllowedDevToolsRequest({ origin: "https://evil.test", host: "127.0.0.1:34437" })).toBe(false);
    expect(isAllowedDevToolsRequest({ origin: "http://127.0.0.1:5173", host: "evil.test:34437" })).toBe(false);
  });

  test("parses and bounds fiber, span, and metric events without trusting HTML", () => {
    const fiber = parseDevToolsEvent('{"type":"fiber","name":"main<&>","status":"running"}');
    const span = parseDevToolsEvent('{"type":"span","name":"loadUser","attributes":{"user":"<script>"}}');
    const metric = parseDevToolsEvent('{"type":"metric","name":"requests","value":2}');

    expect(fiber).toMatchObject({ type: "fiber", name: "main<&>", status: "running" });
    expect(span).toMatchObject({ type: "span", name: "loadUser" });
    expect(metric).toMatchObject({ type: "metric", name: "requests", value: 2 });
    expect(devToolsEventLabel(span)).toContain("<script>");
    expect(boundedDevToolsEvents([fiber, span], metric, 2)).toEqual([span, metric]);
  });
});
