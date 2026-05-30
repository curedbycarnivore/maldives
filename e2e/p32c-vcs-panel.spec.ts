import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("P32c drives VCS/changes/checkin/shelve/annotate actions through a real panel", async ({ page }) => {
  await loadEditor(page);
  const stressSource = await readFile("e2e/fixtures/effect-stress-app.tsx", "utf-8");
  const proofLineNumber = 180;
  const proofLine = stressSource.split("\n")[proofLineNumber - 1]?.trim() ?? "";

  await page.evaluate(({ source, lineNumber }) => {
    const uri = window.__monaco.Uri.parse("file:///workspace/effect-stress-app.tsx");
    const model = window.__monaco.editor.createModel(source, "typescript", uri);
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.setPosition({ lineNumber, column: 1 });
    window.__maldivesEditor.focus();
  }, { source: stressSource, lineNumber: proofLineNumber });

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Annotate"))).toBe(true);
  await expect(page.locator(".maldives-vcs-panel")).toBeVisible();
  await expect(page.locator(".maldives-vcs-title")).toHaveText("Annotate");
  await expect(page.locator(".maldives-vcs-body")).toContainText(`Line ${proofLineNumber}: ${proofLine}`);

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ChangesView.AddUnversioned"))).toBe(true);
  await expect(page.locator(".maldives-vcs-body")).toContainText("Tracked file: file:///workspace/effect-stress-app.tsx");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ChangesView.ShelveSilently"))).toBe(true);
  await expect(page.locator(".maldives-vcs-title")).toHaveText("Shelve Changes");
  await expect(page.locator(".maldives-vcs-body")).toContainText("Shelved");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("CheckinProject"))).toBe(true);
  await expect(page.locator(".maldives-vcs-title")).toHaveText("Commit");
  await expect(page.locator(".maldives-vcs-body")).toContainText("Commit draft includes file:///workspace/effect-stress-app.tsx");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Git.Branches"))).toBe(true);
  await expect(page.locator(".maldives-vcs-body")).toContainText("Current branch: browser-workspace");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Diff.NextChange"))).toBe(true);
  await expect(page.locator(".maldives-vcs-body")).toContainText("Selected change 1/3");

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Diff.NextConflict"))).toBe(true);
  await expect(page.locator(".maldives-vcs-body")).toContainText("Selected conflict 1/2");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32c-vcs-panel.png" });
});
