import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const effectSnippetCases = [
  { label: "eff-pipe", expected: "pipe(" },
  { label: "eff-gen", expected: "Effect.gen(function*" },
  { label: "eff-match", expected: "Match.value(" },
  { label: "eff-tap", expected: "Effect.tap(" },
  { label: "eff-catchAll", expected: "Effect.catchAll(" },
  { label: "eff-catchTag", expected: "Effect.catchTag(" },
  { label: "eff-andThen", expected: "Effect.andThen(" },
  { label: "eff-flatMap", expected: "Effect.flatMap(" },
  { label: "eff-mapError", expected: "Effect.mapError(" },
  { label: "eff-runPromise", expected: "Effect.runPromise(" },
  { label: "eff-runSync", expected: "Effect.runSync(" },
  { label: "eff-layer", expected: "Layer.effect(" },
  { label: "eff-context", expected: "Context.GenericTag<" },
  { label: "eff-service", expected: "class Service extends Context.Tag(" },
  { label: "eff-schedule", expected: "Schedule.exponential(" },
  { label: "eff-fork", expected: "Effect.fork(" },
  { label: "eff-race", expected: "Effect.race(" },
  { label: "opt-some", expected: "Option.some(" },
  { label: "opt-none", expected: "Option.none()" },
  { label: "opt-match", expected: "Option.match(" },
  { label: "eit-left", expected: "Either.left(" },
  { label: "eit-right", expected: "Either.right(" },
  { label: "eit-match", expected: "Either.match(" },
] as const;

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("shows Effect snippet suggestions for the eff- prefix", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setValue("eff-");
    editor.setPosition({ lineNumber: 1, column: 5 });
    editor.focus();
    editor.trigger("test", "editor.action.triggerSuggest", {});
  });

  await expect(page.locator(".suggest-widget")).toBeVisible();
  await expect(page.locator(".suggest-widget")).toContainText("eff-pipe", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/effect-snippets.png" });
});

test("HippieCompletion keybinding opens Effect snippet suggestions", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setValue("eff-");
    editor.setPosition({ lineNumber: 1, column: 5 });
    editor.focus();
    return window.__maldivesExecuteKeybinding("HippieCompletion");
  });

  expect(opened).toBe(true);
  await expect(page.locator(".suggest-widget")).toBeVisible();
  await expect(page.locator(".suggest-widget")).toContainText("eff-pipe", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/hippie-completion-proof.png" });
});

test("accepts every practical Effect snippet from the live completion list", async ({ page }) => {
  await loadEditor(page);

  for (const snippet of effectSnippetCases) {
    await page.evaluate((label) => {
      const editor = window.__maldivesEditor;
      editor.setValue(label);
      editor.setPosition({ lineNumber: 1, column: label.length + 1 });
      editor.focus();
      editor.trigger("test", "editor.action.triggerSuggest", {});
    }, snippet.label);

    await expect(page.locator(".suggest-widget")).toContainText(snippet.label, { timeout: 15000 });
    await page.evaluate(() => window.__maldivesEditor.trigger("test", "acceptSelectedSuggestion", {}));
    await expect
      .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
      .toContain(snippet.expected);
  }

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12a-effect-snippets-proof.png" });
});
