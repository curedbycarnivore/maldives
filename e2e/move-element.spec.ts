import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
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
