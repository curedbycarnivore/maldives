import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}


test("Promise to Effect.gen code action rewrites an async function", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
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
  });

  const convertAction = page.locator('.action-widget .monaco-list-row:has-text("Convert to Effect.gen")');
  await expect(async () => {
    const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("IntroduceActionsGroup"));
    expect(opened).toBe(true);
    await convertAction.waitFor({ state: "visible", timeout: 1000 });
  }).toPass({ timeout: 15000 });
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
