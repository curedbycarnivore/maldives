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
  // double-check: editor mounted + still mounted 300ms later (survives Vite HMR reload)
  await expect.poll(async () => {
    const mounted = await page.evaluate(() => Boolean(window.__maldivesEditor)).catch(() => false);
    if (!mounted) return false;
    await page.waitForTimeout(300);
    return page.evaluate(() => Boolean(window.__maldivesEditor)).catch(() => false);
  }, { timeout: 15000 }).toBe(true);
}

test("back and forward keybindings replay Monaco cursor history", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo\nthree");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 2 });
    window.__maldivesEditor.setPosition({ lineNumber: 3, column: 3 });
  });

  await page.evaluate(() => window.__maldivesExecuteKeybinding("Back"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition())).toEqual({
    lineNumber: 2,
    column: 2,
  });

  await page.evaluate(() => window.__maldivesExecuteKeybinding("Forward"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition())).toEqual({
    lineNumber: 3,
    column: 3,
  });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/back-forward-navigation.png" });
});
