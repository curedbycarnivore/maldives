import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}


test("keymap coverage audit exercises a newly covered editor action", async ({ page }) => {
  await loadEditor(page);

  const deleted = await page.evaluate(() => {
    window.__maldivesEditor.setValue("abc");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 4 });
    window.__maldivesEditor.focus();

    return window.__maldivesExecuteKeybinding("EditorBackSpace");
  });

  expect(deleted).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("ab");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p6e-keymap-coverage-proof.png" });
});
