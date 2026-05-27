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

test("unselect previous occurrence removes the last occurrence selection", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha alpha alpha alpha");
    window.__maldivesEditor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 });
    window.__maldivesExecuteKeybinding("SelectNextOccurrence");
    window.__maldivesExecuteKeybinding("SelectNextOccurrence");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getSelections()?.length ?? 0)).toBe(3);

  await page.evaluate(() => window.__maldivesExecuteKeybinding("UnselectPreviousOccurrence"));

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getSelections()?.length ?? 0)).toBe(2);
  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/unselect-occurrence.png" });
});

test("line navigation keybindings move and delete within the current line", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha beta gamma");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 8 });
    return window.__maldivesExecuteKeybinding("EditorLineStart");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorLineEnd"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(17);

  await page.evaluate(() => {
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 12 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToLineStart");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("gamma");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/line-nav-proof.png" });
});

test("file structure popup opens Monaco quick outline", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("FileStructurePopup"));

  expect(opened).toBe(true);
  await page.locator(".quick-input-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".quick-input-widget")).toContainText("XMLParser");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/file-structure-popup-proof.png" });
});

test("search everywhere opens Monaco command palette", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("SearchEverywhere"));

  expect(opened).toBe(true);
  await expect(page.locator(".quick-input-widget")).toBeVisible();
  await expect(page.locator(".quick-input-widget input")).toHaveValue(">");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/search-everywhere-proof.png" });
});

test("registered addCommand keybindings work across groups", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha alpha alpha");
    window.__maldivesEditor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 });
    return window.__maldivesExecuteKeybinding("SelectNextOccurrence");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getSelections()?.length ?? 0)).toBeGreaterThan(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
    return window.__maldivesExecuteKeybinding("EditorNextWordInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column ?? 1)).toBeGreaterThan(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 6 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToWordEndInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("camelWord");

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 10 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToWordStartInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("camelWord");

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
    return window.__maldivesExecuteKeybinding("MoveLineDown");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("two\none");

  await expect(
    page.evaluate(() => {
      window.__maldivesEditor.setValue("function f() {\n  return 1;\n}\n");
      window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
      return window.__maldivesExecuteKeybinding("CollapseRegion");
    }),
  ).resolves.toBe(true);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("const x = 1;");
    window.__maldivesEditor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 13 });
    return window.__maldivesExecuteKeybinding("CommentByBlockComment");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("/*");

  await expect(
    page.evaluate(() => {
      window.__maldivesEditor.setValue("const  x=1");
      return window.__maldivesExecuteKeybinding("ReformatCode");
    }),
  ).resolves.toBe(true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/keybindings-proof.png" });
});
