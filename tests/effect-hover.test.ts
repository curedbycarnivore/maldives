import { describe, expect, test } from "vitest";
import { EFFECT_HOVER_DOCS, effectHoverDocForSymbol, layerDependencyDiagramForSourceAtOffset } from "../src/effect-hover";

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

  test("builds a Layer dependency diagram from nested Layer expressions", () => {
    const source = `import { Layer } from "effect";
const A = {};
const B = {};
const C = {};
const Live = Layer.merge(A, Layer.provide(B, C));`;

    const diagram = layerDependencyDiagramForSourceAtOffset(source, source.indexOf("Layer.merge") + 1);

    expect(diagram).toBe(`Layer dependency diagram\nLayers:\n- A\n- B\n- C\nEdges:\n- C -> B`);
  });
});
