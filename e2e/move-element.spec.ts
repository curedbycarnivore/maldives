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
  // wait for @ast-grep/wasm to initialize before invoking AST-backed movement
  await page.waitForTimeout(3000);
}

test("MoveElementLeft and MoveElementRight reorder adjacent TypeScript elements", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("call(first, second, third);\n");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 13 });
    return window.__maldivesExecuteKeybinding("MoveElementLeft");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue().replaceAll("\r\n", "\n"))).toBe(
    "call(second, first, third);\n",
  );

  await page.evaluate(() => window.__maldivesExecuteKeybinding("MoveElementRight"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue().replaceAll("\r\n", "\n"))).toBe(
    "call(first, second, third);\n",
  );

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/move-element-proof.png" });
});
