import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const effectDtsFixture = {
  "/node_modules/effect/dist/dts/index.d.ts": 'export * as Predicate from "./Predicate.js";',
  "/node_modules/effect/dist/dts/Predicate.d.ts": "export declare const isString: (value: unknown) => value is string;\nexport declare const isNumber: (value: unknown) => value is number;",
};

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
    __maldivesRegisterEffectDtsFiles: (files: Record<string, string>) => { dispose: () => void };
  }
}

test("full Effect declaration ingestion resolves deeper installed Effect modules", async ({ page }) => {
  await loadEditor(page);

  const diagnostics = await page.evaluate(async (files) => {
    window.__maldivesRegisterEffectDtsFiles(files);

    const sample = `import * as Predicate from "effect/Predicate";\n\nconst value = Predicate.`;
    const uri = window.__monaco.Uri.parse("file:///maldives/effect-full-dts.ts");
    const model = window.__monaco.editor.createModel(sample, "typescript", uri);
    const editor = window.__maldivesEditor;
    editor.setModel(model);
    editor.setPosition({ lineNumber: 3, column: 25 });
    editor.focus();

    const getWorker = await window.__monaco.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker(uri);
    const semanticDiagnostics = await worker.getSemanticDiagnostics(uri.toString());
    editor.trigger("test", "editor.action.triggerSuggest", {});

    return semanticDiagnostics.map((diagnostic) => diagnostic.messageText.toString());
  }, effectDtsFixture);

  expect(diagnostics.join("\n")).not.toContain("Cannot find module 'effect/Predicate'");
  await expect(page.locator(".suggest-widget")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".suggest-widget")).toContainText("isString", { timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p10-effect-full-dts-proof.png" });
});
