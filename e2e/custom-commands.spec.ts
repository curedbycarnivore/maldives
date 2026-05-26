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

test("hump-delete commands delete across camel-case boundaries", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 6 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToWordEndInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("camelWord");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(6);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 10 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToWordStartInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("camelWord");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(6);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/hump-delete.png" });
});
