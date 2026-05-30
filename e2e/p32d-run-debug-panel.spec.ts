import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("P32d drives run/debug lifecycle actions through a real panel", async ({ page }) => {
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

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ChooseDebugConfiguration"))).toBe(true);
  await expect(page.locator(".maldives-run-debug-panel")).toBeVisible();
  await expect(page.locator(".maldives-run-debug-title")).toHaveText("Choose Debug Configuration");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Configuration:");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Run"))).toBe(true);
  await expect(page.locator(".maldives-run-debug-title")).toHaveText("Run");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Status: running");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("effect-stress-app.tsx");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("DebugClass"))).toBe(true);
  await expect(page.locator(".maldives-run-debug-title")).toHaveText("Debug Class");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Status: debugging");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Debugger attached");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Resume"))).toBe(true);
  await expect(page.locator(".maldives-run-debug-title")).toHaveText("Resume");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Status: running");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("RerunTests"))).toBe(true);
  await expect(page.locator(".maldives-run-debug-title")).toHaveText("Rerun Tests");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Test runner: active file diagnostics");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Stop"))).toBe(true);
  await expect(page.locator(".maldives-run-debug-title")).toHaveText("Stop");
  await expect(page.locator(".maldives-run-debug-body")).toContainText("Status: stopped");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32d-run-debug-panel.png" });
});
