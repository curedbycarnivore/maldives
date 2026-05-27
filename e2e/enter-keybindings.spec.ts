import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesKeybindings: Array<{ wsActionId: string; monacoBinding: number; commandId: string }>;
  }
}

type EnterShortcut = "cmd+enter" | "opt+enter" | "shift+enter";

async function executeEnterShortcut(page: Page, wsActionId: string, shortcut: EnterShortcut): Promise<boolean> {
  return page.evaluate(
    ({ wsActionId, shortcut }) => {
      const { KeyCode, KeyMod } = window.__monaco;
      const expectedBinding =
        shortcut === "cmd+enter"
          ? KeyMod.CtrlCmd | KeyCode.Enter
          : shortcut === "opt+enter"
            ? KeyMod.Alt | KeyCode.Enter
            : KeyMod.Shift | KeyCode.Enter;
      const registered = window.__maldivesKeybindings.find(
        (action) => action.wsActionId === wsActionId && action.monacoBinding === expectedBinding,
      );

      if (!registered) {
        return false;
      }

      window.__maldivesEditor.trigger("maldives", registered.commandId, null);
      return true;
    },
    { wsActionId, shortcut },
  );
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

test("cmd/opt/shift enter WebStorm actions fire when Monaco suggestions are hidden", async ({ page }) => {
  await loadEditor(page);
  await expectSuggestWidgetHidden(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 2 });
  });
  const insertedBefore = await executeEnterShortcut(page, "EditorStartNewLineBefore", "cmd+enter");

  expect(insertedBefore).toBe(true);
  await expectSuggestWidgetHidden(page);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("one\n\ntwo");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 2 });
  });
  const insertedAfter = await executeEnterShortcut(page, "EditorStartNewLine", "opt+enter");

  expect(insertedAfter).toBe(true);
  await expectSuggestWidgetHidden(page);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("one\n\ntwo");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("const value = 1");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 16 });
  });
  const completedStatement = await executeEnterShortcut(page, "EditorCompleteStatement", "shift+enter");

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
  // Maldives' shift+enter complete-statement handler also intentionally avoids
  // running while editor.hasWidgetFocus() is true, so the executable proof above
  // keeps the widget hidden for the cmd+enter/opt+enter/shift+enter baseline.
});
