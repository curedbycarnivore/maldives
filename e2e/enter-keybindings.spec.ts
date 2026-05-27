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
  // wait for @ast-grep/wasm to initialize — completeStatementWhenReady is async on first call
  await page.waitForTimeout(3000);
}

async function expectSuggestWidgetHidden(page: Page): Promise<void> {
  await expect(page.locator(".suggest-widget")).toBeHidden();
}

test("enter-key WebStorm actions fire when Monaco suggestions are hidden", async ({ page }) => {
  await loadEditor(page);
  await expectSuggestWidgetHidden(page);

  const insertedBefore = await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 2 });
    return window.__maldivesExecuteKeybinding("EditorStartNewLineBefore");
  });

  expect(insertedBefore).toBe(true);
  await expectSuggestWidgetHidden(page);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("one\n\ntwo");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  const insertedAfter = await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 2 });
    return window.__maldivesExecuteKeybinding("EditorStartNewLine");
  });

  expect(insertedAfter).toBe(true);
  await expectSuggestWidgetHidden(page);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("one\n\ntwo");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  const completedStatement = await page.evaluate(() => {
    window.__maldivesEditor.setValue("const value = 1");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 16 });
    return window.__maldivesExecuteKeybinding("EditorCompleteStatement");
  });

  expect(completedStatement).toBe(true);
  await expectSuggestWidgetHidden(page);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("const value = 1;");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(17);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p4d-enter-keybindings-proof.png" });
});

test.skip("visible Monaco suggestions keep Enter/Shift+Enter in suggestion-acceptance mode", async () => {
  // Documentation-only: when .suggest-widget is visible, Monaco binds Enter to
  // acceptSelectedSuggestion and Shift+Enter to acceptAlternativeSelectedSuggestion.
  // Maldives' completeStatementWhenReady also intentionally avoids running while
  // editor.hasWidgetFocus() is true, so the proof above keeps the widget hidden.
});
