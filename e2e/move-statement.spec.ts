import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}


test("MoveStatementDown and MoveStatementUp reorder adjacent TypeScript statements", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("function demo() {\n  const first = 1;\n  const second = 2;\n}\n");
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 10 });
    return window.__maldivesExecuteKeybinding("MoveStatementDown");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue().replaceAll("\r\n", "\n"))).toBe(
    "function demo() {\n  const second = 2;\n  const first = 1;\n}\n",
  );
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(3);

  await page.evaluate(() => window.__maldivesExecuteKeybinding("MoveStatementUp"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue().replaceAll("\r\n", "\n"))).toBe(
    "function demo() {\n  const first = 1;\n  const second = 2;\n}\n",
  );
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/move-statement-proof.png" });
});
