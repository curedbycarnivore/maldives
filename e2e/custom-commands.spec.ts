import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
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

test("toggleCase transforms selected text case", async ({ page }) => {
  await loadEditor(page);

  const result = await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setValue("hello world");
    editor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 });
    window.__maldivesExecuteKeybinding("EditorToggleCase");
    return editor.getValue();
  });
  expect(result).toBe("HELLO world");

  const lowered = await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 });
    window.__maldivesExecuteKeybinding("EditorToggleCase");
    return editor.getValue();
  });
  expect(lowered).toBe("hello world");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/toggle-case.png" });
});
