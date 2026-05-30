import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("P32b activates IDE tool windows from real keymap actions", async ({ page }) => {
  await loadEditor(page);
  const stressSource = await readFile("e2e/fixtures/effect-stress-app.tsx", "utf-8");

  await page.evaluate((source) => {
    window.__maldivesEditor.setValue(source);
    window.__maldivesEditor.setPosition({ lineNumber: 180, column: 1 });
    window.__maldivesEditor.focus();
  }, stressSource);

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ActivateTerminalToolWindow"))).toBe(true);
  await expect(page.locator(".maldives-tool-window")).toBeVisible();
  await expect(page.locator(".maldives-tool-window-title")).toHaveText("Terminal");
  await expect(page.locator(".maldives-tool-window-body")).toContainText("Integrated terminal action is wired");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ActivateVersionControlToolWindow"))).toBe(true);
  await expect(page.locator(".maldives-tool-window-title")).toHaveText("Version Control");
  await expect(page.locator(".maldives-tool-window-body")).toContainText("VCS tool-window action is wired");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("NextWindow"))).toBe(true);
  await expect(page.locator(".maldives-tool-window-title")).toHaveText("Terminal");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32b-tool-window-activation.png" });

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("HideAllWindows"))).toBe(true);
  await expect(page.locator(".maldives-tool-window")).toHaveCount(0);
});
