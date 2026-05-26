import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
  }
}

async function loadEditor(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);
}

test("blur cleanup removes trailing blank lines and keeps one EOF newline", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha   \nbeta\n\n   \n");
    window.__maldivesEditor.focus();

    const blurTarget = document.createElement("button");
    blurTarget.textContent = "blur target";
    document.body.append(blurTarget);
    blurTarget.focus();
  });

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("alpha\nbeta\n");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/behavioral-hooks.png" });
});
