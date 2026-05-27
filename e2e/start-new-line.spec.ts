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

test("start-new-line keybindings insert blank lines above and below the current line", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 2 });
    return window.__maldivesExecuteKeybinding("EditorStartNewLine");
  });

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("one\n\ntwo");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 2 });
    return window.__maldivesExecuteKeybinding("EditorStartNewLineBefore");
  });

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("one\n\ntwo");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/start-new-line-proof.png" });
});
