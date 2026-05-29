import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
  }
}

function complexLookalikeSource(): string {
  return `import { Effect, Layer, Schema, pipe } from "effect";
import { pipe as lodashPipe } from "lodash";

function logged(_target: unknown, _key: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

interface Repository<T extends { id: string }> {
  find(id: string): Effect.Effect<T | undefined>;
}

class MyLayer<T extends { id: string }> implements Repository<T> {
  constructor(private readonly rows: ReadonlyArray<T>) {}

  @logged
  find(id: string): Effect.Effect<T | undefined> {
    return pipe(
      Effect.succeed(this.rows.find((row): row is T => row.id === id)),
      Effect.map((row) => row)
    );
  }

  pipeline(value: number) {
    return lodashPipe(value);
  }
}

const User = Schema.Struct({ id: Schema.String, name: Schema.String });
const customLayerValue: Layer.Layer<MyLayer<{ id: string; name: string }>> = Layer.effect("Repo", Effect.succeed(new MyLayer([{ id: "1", name: "Ada" }])));
`;
}

const hoverCases = [
  { symbol: "Effect.gen", needle: "Effect.gen", url: "https://effect.website/docs/getting-started/using-generators/" },
  { symbol: "Effect.map", needle: "Effect.map", url: "https://effect.website/docs/getting-started/using-generators/" },
  { symbol: "pipe", needle: "pipe", url: "https://effect.website/docs/code-style/pipeline/" },
  { symbol: "Layer", needle: "Layer.effect", url: "https://effect.website/docs/requirements-management/layers/" },
  { symbol: "Schema", needle: "Schema.Struct", url: "https://effect.website/docs/schema/introduction/" },
  { symbol: "Match", needle: "Match.value", url: "https://effect.website/docs/code-style/pattern-matching/" },
  { symbol: "Option", needle: "Option.some", url: "https://effect.website/docs/data-types/option/" },
  { symbol: "Either", needle: "Either.right", url: "https://effect.website/docs/data-types/either/" },
  { symbol: "Schedule", needle: "Schedule.exponential", url: "https://effect.website/docs/scheduling/schedules/" },
  { symbol: "Stream", needle: "Stream.fromIterable", url: "https://effect.website/docs/stream/introduction/" },
  { symbol: "Fiber", needle: "Fiber.interrupt", url: "https://effect.website/docs/concurrency/fibers/" },
] as const;

const sample = `import { Effect, Either, Fiber, Layer, Match, Option, Schedule, Schema, Stream, pipe } from "effect";

const generated = Effect.gen(function* () { return 1; });
const mapped = Effect.map((value: number) => value + 1);
const piped = pipe(1, (value) => value + 1);
const layer = Layer.effect("Service", Effect.succeed(1));
const schema = Schema.Struct({ name: Schema.String });
const matched = Match.value("ready");
const option = Option.some(1);
const either = Either.right(1);
const schedule = Schedule.exponential("100 millis");
const stream = Stream.fromIterable([1, 2, 3]);
const fiber = Fiber.interrupt;
`;

test("Layer composition hover shows a dependency mini-diagram", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const source = `import { Effect, Layer } from "effect";

const A = Layer.effect("A", Effect.succeed(1));
const B = Layer.effect("B", Effect.succeed(2));
const C = Layer.effect("C", Effect.succeed(3));
const Live = Layer.merge(A, Layer.provide(B, C));
`;
    const model = window.__monaco.editor.createModel(source, "typescript", window.__monaco.Uri.parse("file:///maldives/effect-layer-hover.ts"));
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.focus();
    const lineNumber = model.getValue().split("\n").findIndex((line) => line.includes("Layer.merge")) + 1;
    const startColumn = model.getLineContent(lineNumber).indexOf("Layer.merge") + 1;
    window.__maldivesEditor.setPosition({ lineNumber, column: startColumn + 1 });
    const action = window.__maldivesEditor.getAction("editor.action.showHover");
    if (!action) throw new Error("editor.action.showHover is not registered");
    void action.run();
  });

  await expect(page.locator(".monaco-hover")).toContainText("Layer dependency diagram", { timeout: 15000 });
  await expect(page.locator(".monaco-hover")).toContainText("- A", { timeout: 15000 });
  await expect(page.locator(".monaco-hover")).toContainText("- B", { timeout: 15000 });
  await expect(page.locator(".monaco-hover")).toContainText("- C", { timeout: 15000 });
  await expect(page.locator(".monaco-hover")).toContainText("C -> B", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12d-layer-diagram-proof.png" });
});

test("Layer hover supports aliased Effect layers and ignores local Layer lookalikes", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const source = `import { Effect, Layer as L, Schema, pipe } from "effect";

function logged(_target: unknown, _key: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

class Repository<T extends { id: string }> {
  constructor(readonly rows: ReadonlyArray<T>) {}

  @logged
  find(id: string) {
    return pipe(
      Effect.succeed(this.rows.find((row) => row.id === id)),
      Effect.map((row) => row)
    );
  }
}

const User = Schema.Struct({ id: Schema.String, name: Schema.String });
const A = L.effect("A", Effect.succeed(new Repository([{ id: "1", name: "Ada" }])));
const B = L.effect("B", Effect.succeed(User));
const C = L.effect("C", Effect.succeed(1));
const Live = L.provideMerge(L.merge(A, B), C);

{
  const L = { merge: (...layers: unknown[]) => layers };
  const shadowedAlias = L.merge(A, B);
}

const Layer = { merge: (...layers: unknown[]) => layers };
const localOnly = Layer.merge(A, B);
`;
    const model = window.__monaco.editor.createModel(source, "typescript", window.__monaco.Uri.parse("file:///maldives/effect-layer-hover-alias.tsx"));
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.focus();
  });

  await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    const model = editor.getModel();
    if (!model) throw new Error("missing model");
    const lineNumber = model.getValue().split("\n").findIndex((line) => line.includes("L.provideMerge")) + 1;
    const startColumn = model.getLineContent(lineNumber).indexOf("L.provideMerge") + 1;
    editor.setPosition({ lineNumber, column: startColumn + 1 });
    editor.focus();
    const action = editor.getAction("editor.action.showHover");
    if (!action) throw new Error("editor.action.showHover is not registered");
    void action.run();
  });

  await expect(page.locator(".monaco-hover")).toContainText("Layer dependency diagram", { timeout: 15000 });
  await expect(page.locator(".monaco-hover")).toContainText("C -> A", { timeout: 15000 });
  await expect(page.locator(".monaco-hover")).toContainText("C -> B", { timeout: 15000 });

  await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    const hideHover = editor.getAction("editor.action.hideHover");
    if (!hideHover) throw new Error("editor.action.hideHover is not registered");
    void hideHover.run();
    const model = editor.getModel();
    if (!model) throw new Error("missing model");
    const lineNumber = model.getValue().split("\n").findIndex((line) => line.includes("shadowedAlias")) + 1;
    const startColumn = model.getLineContent(lineNumber).indexOf("L.merge") + 1;
    editor.setPosition({ lineNumber, column: startColumn + 1 });
    editor.focus();
    const action = editor.getAction("editor.action.showHover");
    if (!action) throw new Error("editor.action.showHover is not registered");
    void action.run();
  });

  await expect(page.locator(".monaco-hover")).not.toContainText("Layer dependency diagram", { timeout: 5000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p14h-layer-hover-alias-proof.png" });
});

test("Effect API hovers show docs links and examples for canonical symbols", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate((source) => {
    const model = window.__monaco.editor.createModel(source, "typescript", window.__monaco.Uri.parse("file:///maldives/effect-hover.ts"));
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.focus();
  }, sample);

  for (const hoverCase of hoverCases) {
    await page.keyboard.press("Escape");
    await page.evaluate(({ needle }) => {
      const editor = window.__maldivesEditor;
      const model = editor.getModel();
      if (!model) throw new Error("missing model");
      const lineNumber = model.getValue().split("\n").findIndex((line) => line.includes(needle)) + 1;
      const startColumn = model.getLineContent(lineNumber).indexOf(needle) + 1;
      const memberOffset = needle.includes(".") ? needle.lastIndexOf(".") + 1 : 0;
      editor.setPosition({ lineNumber, column: startColumn + memberOffset });
      editor.focus();
      const action = editor.getAction("editor.action.showHover");
      if (!action) throw new Error("editor.action.showHover is not registered");
      void action.run();
    }, hoverCase);

    await expect(page.locator(".monaco-hover"), hoverCase.symbol).toContainText(hoverCase.url, { timeout: 15000 });
    await expect(page.locator(".monaco-hover"), hoverCase.symbol).toContainText("Example", { timeout: 15000 });
  }

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12b-effect-hover-proof.png" });
});

test("Effect hover ignores substring lookalikes from non-Effect symbols", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate((source) => {
    const model = window.__monaco.editor.createModel(source, "typescript", window.__monaco.Uri.parse("file:///maldives/effect-hover-lookalikes.ts"));
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.focus();
  }, complexLookalikeSource());

  for (const needle of ["MyLayer", "pipeline", "customLayerValue", "lodashPipe"] as const) {
    await page.keyboard.press("Escape");
    await page.evaluate((target) => {
      const editor = window.__maldivesEditor;
      const model = editor.getModel();
      if (!model) throw new Error("missing model");
      const lineNumber = model.getValue().split("\n").findIndex((line) => line.includes(target)) + 1;
      const startColumn = model.getLineContent(lineNumber).indexOf(target) + 1;
      editor.setPosition({ lineNumber, column: startColumn + 1 });
      editor.focus();
      const action = editor.getAction("editor.action.showHover");
      if (!action) throw new Error("editor.action.showHover is not registered");
      void action.run();
    }, needle);

    await expect(page.locator(".monaco-hover")).not.toContainText("Effect docs", { timeout: 5000 });
  }

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p14c-effect-hover-lookalikes-proof.png" });
});
