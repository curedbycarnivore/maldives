import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("P32e adds the active Effect file location to favorites through a real panel", async ({ page }) => {
  await loadEditor(page);
  const stressSource = await readFile("e2e/fixtures/effect-stress-app.tsx", "utf-8");
  const proofLineNumber = 154;

  await page.evaluate(({ source, lineNumber }) => {
    const uri = window.__monaco.Uri.parse("file:///workspace/effect-stress-app.tsx");
    const model = window.__monaco.editor.createModel(source, "typescript", uri);
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.setPosition({ lineNumber, column: 1 });
    window.__maldivesEditor.focus();
  }, { source: stressSource, lineNumber: proofLineNumber });

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("AddToFavoritesPopup"))).toBe(true);
  await expect(page.locator(".maldives-favorites-panel")).toBeVisible();
  await expect(page.locator(".maldives-favorites-title")).toHaveText("Add to Favorites");
  await expect(page.locator(".maldives-favorites-body")).toContainText("Favorites: 1");
  await expect(page.locator(".maldives-favorites-body")).toContainText("effect-stress-app.tsx:154");
  await expect(page.locator(".maldives-favorites-body")).toContainText("Effect");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32e-favorites-panel.png" });
});
