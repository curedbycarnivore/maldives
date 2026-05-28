import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
  }
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

test("Effect API hovers show docs links and examples for canonical symbols", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor)), { timeout: 15000 }).toBe(true);

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
      void editor.getAction("editor.action.showHover")?.run();
    }, hoverCase);

    await expect(page.locator(".monaco-hover"), hoverCase.symbol).toContainText(hoverCase.url, { timeout: 15000 });
    await expect(page.locator(".monaco-hover"), hoverCase.symbol).toContainText("Example", { timeout: 15000 });
  }

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12b-effect-hover-proof.png" });
});
