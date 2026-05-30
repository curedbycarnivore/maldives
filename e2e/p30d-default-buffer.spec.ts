import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
  }
}

test("default buffer is a real Effect TSX workload, not the toy sample", async ({ page }) => {
  await loadEditor(page);

  const loaded = await page.evaluate(() => {
    const model = window.__maldivesEditor.getModel();
    return {
      path: model?.uri.path,
      value: window.__maldivesEditor.getValue(),
      lineCount: model?.getLineCount() ?? 0,
    };
  });

  expect(loaded.path).toBe("/maldives/sample.tsx");
  expect(loaded.value).not.toContain("Maldives deterministic sample");
  expect(loaded.value).toContain("@Injectable()");
  expect(loaded.value).toContain("class XMLParser<T extends");
  expect(loaded.value).toContain("Effect.gen(function* ()");
  expect(loaded.value).toContain("Layer.succeed");
  expect(loaded.value).toContain("Schema.Struct");
  expect(loaded.lineCount).toBeGreaterThanOrEqual(30);

  await page.evaluate(() => {
    window.__maldivesEditor.setPosition({ lineNumber: 15, column: 7 });
    window.__maldivesEditor.revealLineInCenter(15);
    window.__maldivesEditor.focus();
  });
  await expect(page.locator(".view-line").filter({ hasText: "Effect.gen" }).first()).toBeVisible();

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p30d-default-buffer.png" });
});
