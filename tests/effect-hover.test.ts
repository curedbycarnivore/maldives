import { describe, expect, test } from "vitest";
import {
  EFFECT_HOVER_DOCS,
  effectHoverDocForSymbol,
  effectHoverSymbolFromQuickInfo,
  effectHoverSymbolFromSourceAtOffset,
  layerDependencyDiagramForSourceAtOffset,
} from "../src/effect-hover";

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

  test("recognizes canonical Effect member symbols from the hovered source position", () => {
    const source = `import { Effect } from "effect";\nconst program = Effect.gen(function* () { return 1; });`;

    expect(effectHoverSymbolFromSourceAtOffset(source, source.indexOf("gen") + 1)).toBe("Effect.gen");
  });

  test("does not recognize substring lookalikes from quick info", () => {
    expect(effectHoverSymbolFromQuickInfo("class MyLayer<T> { readonly pipeline = true }")).toBeUndefined();
    expect(effectHoverSymbolFromQuickInfo("const pipeline: (value: number) => number")).toBeUndefined();
  });

  test("does not recognize non-Effect imports from hovered source positions", () => {
    const source = `import { pipe } from "lodash";\nclass MyLayer<T> { value!: T }\nconst piped = pipe(1);`;

    expect(effectHoverSymbolFromSourceAtOffset(source, source.indexOf("MyLayer") + 1)).toBeUndefined();
    expect(effectHoverSymbolFromSourceAtOffset(source, source.lastIndexOf("pipe") + 1)).toBeUndefined();
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
