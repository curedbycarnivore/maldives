import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

async function loadEditor(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);
}

test("Promise to Effect.gen code action rewrites an async function", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => {
    window.__maldivesEditor.setValue([
      "async function loadName(): Promise<string> {",
      "  const name = await fetchName();",
      "  return name;",
      "}",
      "",
      "function fetchName(): Promise<string> {",
      "  return Promise.resolve(\"Ada\");",
      "}",
    ].join("\n"));
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 23 });
    window.__maldivesEditor.focus();

    return window.__maldivesExecuteKeybinding("IntroduceActionsGroup");
  });

  expect(opened).toBe(true);
  await page.locator(".action-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".action-widget")).toContainText("Convert to Effect.gen");
  await page.keyboard.press("Enter");

  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toContain("Effect.gen(function*");
  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toContain("yield* Effect.tryPromise(() => fetchName())");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12c-promise-to-effect-proof.png" });
});
