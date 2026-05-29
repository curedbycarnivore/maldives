import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
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
