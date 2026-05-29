import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
    __maldivesTypeScriptReady: Promise<void>;
  }
}

async function loadEditor(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor)), { timeout: 15000 }).toBe(true);
  await page.evaluate(() => window.__maldivesTypeScriptReady);
}

test("Effect type stubs power TypeScript worker diagnostics and completions", async ({ page }) => {
  await loadEditor(page);
  await page.waitForTimeout(1000);

  const diagnostics = await page.evaluate(async () => {
    const sample = `import { Effect, pipe, Option, Either, Schema } from "effect";

const program = Effect.gen(function* () {
  const value = yield* Effect.succeed(1);
  return value;
});

const piped = pipe(Option.some(1), Option.map((n) => n + 1));
const either = Either.right("ok");
const schema = Schema.Struct({ name: Schema.String, count: Schema.Number });
Effect.`;

    const uri = window.__monaco.Uri.parse("file:///maldives/effect-type-stubs.ts");
    const model = window.__monaco.editor.createModel(sample, "typescript", uri);
    const editor = window.__maldivesEditor;
    editor.setModel(model);
    editor.setPosition({ lineNumber: 12, column: 8 });
    editor.focus();

    const getWorker = await window.__monaco.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker(uri);
    const semanticDiagnostics = await worker.getSemanticDiagnostics(uri.toString());

    editor.trigger("test", "editor.action.triggerSuggest", {});

    return semanticDiagnostics.map((diagnostic) => diagnostic.messageText.toString());
  });

  expect(diagnostics.join("\n")).not.toContain("Cannot find module 'effect'");
  await expect(page.locator(".suggest-widget")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".suggest-widget")).toContainText("gen", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p9-effect-type-stubs-proof.png" });
});
