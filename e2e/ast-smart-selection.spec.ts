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
  // double-check: wait for editor, then verify still mounted 300ms later (survives Vite HMR reload)
  await expect.poll(async () => {
    const mounted = await page.evaluate(() => Boolean(window.__maldivesEditor)).catch(() => false);
    if (!mounted) return false;
    await page.waitForTimeout(300);
    return page.evaluate(() => Boolean(window.__maldivesEditor)).catch(() => false);
  }, { timeout: 15000 }).toBe(true);
}

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

  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorSelectWord"));
  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.getValueInRange(window.__maldivesEditor.getSelection()!)))
    .toBe("alpha");

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
