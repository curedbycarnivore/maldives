import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
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
