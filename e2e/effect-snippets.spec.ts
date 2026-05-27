import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("shows Effect snippet suggestions for the eff- prefix", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);

  await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setValue("eff-");
    editor.setPosition({ lineNumber: 1, column: 5 });
    editor.focus();
    editor.trigger("test", "editor.action.triggerSuggest", {});
  });

  await expect(page.locator(".suggest-widget")).toBeVisible();
  await expect(page.locator(".suggest-widget")).toContainText("eff-pipe", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/effect-snippets.png" });
});

test("HippieCompletion keybinding opens Effect snippet suggestions", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);

  const opened = await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setValue("eff-");
    editor.setPosition({ lineNumber: 1, column: 5 });
    editor.focus();
    return window.__maldivesExecuteKeybinding("HippieCompletion");
  });

  expect(opened).toBe(true);
  await expect(page.locator(".suggest-widget")).toBeVisible();
  await expect(page.locator(".suggest-widget")).toContainText("eff-pipe", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/hippie-completion-proof.png" });
});
