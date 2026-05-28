import { describe, expect, test } from "vitest";
import { EFFECT_HOVER_DOCS, effectHoverDocForSymbol } from "../src/effect-hover";

const canonicalSymbols = [
  "Effect.gen",
  "Effect.map",
  "pipe",
  "Layer",
  "Schema",
  "Match",
  "Option",
  "Either",
  "Schedule",
  "Stream",
  "Fiber",
] as const;

describe("Effect hover docs", () => {
  test("covers the canonical Effect symbols with docs URLs and examples", () => {
    expect(Object.keys(EFFECT_HOVER_DOCS).sort()).toEqual([...canonicalSymbols].sort());

    for (const symbol of canonicalSymbols) {
      const doc = effectHoverDocForSymbol(symbol);
      expect(doc?.summary).toBeTruthy();
      expect(doc?.example).toBeTruthy();
      expect(doc?.url).toMatch(/^https:\/\/effect\.website\/docs\//);
      expect(doc?.url).not.toContain("undefined");
      expect(doc?.url).not.toContain("localhost");
    }
  });
});
