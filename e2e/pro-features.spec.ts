import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
  }
}

test("renders Monaco pro feature sticky scroll proof", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.updateOptions({ stickyScroll: { enabled: true, maxLineCount: 5 } });
    editor.setValue(`class StickyScrollProof {
  public run(): void {
${Array.from({ length: 80 }, (_, index) => `    const line${index} = ${index};`).join("\n")}
  }
}
`);
    editor.setPosition({ lineNumber: 1, column: 1 });
    editor.setScrollTop(900);
    editor.focus();
  });

  const stickyWidget = page.locator(".monaco-editor .sticky-widget");
  await expect(stickyWidget).toBeVisible();

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/pro-features.png" });
});
