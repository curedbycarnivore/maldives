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
  // wait for @ast-grep/wasm to initialize — completeStatementWhenReady is async on first call
  await page.waitForTimeout(3000);
}

test("EditorCompleteStatement completes statements through the registered keybinding", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("const value = 1");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 16 });
    return window.__maldivesExecuteKeybinding("EditorCompleteStatement");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("const value = 1;");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(17);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("console.log(value");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 18 });
    return window.__maldivesExecuteKeybinding("EditorCompleteStatement");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("console.log(value)");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(19);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("if (ready)");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 11 });
    return window.__maldivesExecuteKeybinding("EditorCompleteStatement");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue().replaceAll("\r\n", "\n"))).toBe("if (ready) {\n  \n}");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(3);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/complete-statement.png" });
});
