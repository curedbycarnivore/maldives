import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}


test("MethodDown and MethodUp navigate between TypeScript method targets", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue([
      "function first() {}",
      "const second = () => {};",
      "class Example {",
      "  method() {}",
      "}",
    ].join("\n"));
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
  });

  await page.evaluate(() => window.__maldivesExecuteKeybinding("MethodDown"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);

  await page.evaluate(() => window.__maldivesExecuteKeybinding("MethodUp"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(1);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/method-navigation-proof.png" });
});

test("EditorSelectWord expands selection through AST boundaries", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("add(alpha, beta)");
    window.__maldivesEditor.setSelection({
      startLineNumber: 1,
      startColumn: 5,
      endLineNumber: 1,
      endColumn: 5,
    });
  });

  await expect(async () => {
    await page.evaluate(() => {
      window.__maldivesEditor.setSelection({
        startLineNumber: 1,
        startColumn: 5,
        endLineNumber: 1,
        endColumn: 5,
      });
      window.__maldivesExecuteKeybinding("EditorSelectWord");
    });
    await expect
      .poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.getValueInRange(window.__maldivesEditor.getSelection()!)), { timeout: 1000 })
      .toBe("alpha");
  }).toPass({ timeout: 10000 });

  await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorSelectWord"));
  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.getValueInRange(window.__maldivesEditor.getSelection()!)))
    .toBe("(alpha, beta)");

  await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorSelectWord"));
  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.getValueInRange(window.__maldivesEditor.getSelection()!)))
    .toBe("add(alpha, beta)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/ast-smart-selection.png" });
});
