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

test("code navigation actions show TypeScript-backed visible results", async ({ page }) => {
  await loadEditor(page);

  for (const actionId of ["GotoSuperMethod", "GotoTest", "MethodHierarchy"] as const) {
    await expect
      .poll(() =>
        page.evaluate((id) => {
          window.__maldivesEditor.setPosition({ lineNumber: 5, column: 4 });
          window.__maldivesEditor.focus();

          return window.__maldivesExecuteKeybinding(id) && Boolean(document.querySelector(".maldives-code-navigation"));
        }, actionId),
      )
      .toBe(true);

    await expect(page.locator(".maldives-code-navigation")).toContainText("TypeScript symbol", { timeout: 8000 });
    await expect(page.locator(".maldives-code-navigation")).toContainText("Standalone Monaco");
  }

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p6d-code-nav-proof.png" });
});
