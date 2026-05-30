import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesTerminalPanel: { execute(line: string, token?: string): { ok: boolean; output: string } };
  }
}

test("P23a drives terminal and task actions through a sandboxed panel", async ({ page }) => {
  await loadEditor(page);
  const stressSource = await readFile("e2e/fixtures/effect-stress-app.tsx", "utf-8");

  await page.evaluate((source) => {
    const uri = window.__monaco.Uri.parse("file:///workspace/effect-stress-app.tsx");
    const model = window.__monaco.editor.createModel(source, "typescript", uri);
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.setPosition({ lineNumber: 154, column: 1 });
    window.__maldivesEditor.focus();
  }, stressSource);

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ActivateTerminalToolWindow"))).toBe(true);
  await expect(page.locator(".maldives-terminal-panel")).toBeVisible();
  await expect(page.locator(".maldives-terminal-title")).toHaveText("Terminal");
  await expect(page.locator(".maldives-terminal-body")).toContainText("Sandbox root: /workspace");
  await expect(page.locator(".maldives-terminal-body")).toContainText("effect-stress-app.tsx");

  const command = await page.evaluate(() => window.__maldivesTerminalPanel.execute("echo Effect.gen Layer Schema", "maldives-terminal-session"));
  expect(command).toEqual({ ok: true, output: "Effect.gen Layer Schema" });
  await expect(page.locator(".maldives-terminal-body")).toContainText("Effect.gen Layer Schema");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("tasks.switch"))).toBe(true);
  await expect(page.locator(".maldives-terminal-body")).toContainText("Task: typecheck");
  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("tasks.goto"))).toBe(true);
  await expect(page.locator(".maldives-terminal-body")).toContainText("file:///workspace/effect-stress-app.tsx:154");
  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("tasks.open.in.browser"))).toBe(true);
  await expect(page.locator(".maldives-terminal-body")).toContainText("Preview: http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("tasks.close"))).toBe(true);
  await expect(page.locator(".maldives-terminal-panel")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ActivateTerminalToolWindow"))).toBe(true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p23a-terminal-panel.png" });
});
