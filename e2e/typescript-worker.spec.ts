import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
  }
}

async function loadEditor(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);
}

test("configures strict TypeScript worker options and renders inlay hints", async ({ page }) => {
  await loadEditor(page);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const { typescript } = window.__monaco;
        const options = typescript.typescriptDefaults.getCompilerOptions();

        return {
          strict: options.strict,
          target: options.target === typescript.ScriptTarget.ESNext,
          module: options.module === typescript.ModuleKind.ESNext,
          moduleResolution: options.moduleResolution,
          lib: options.lib,
          eagerModelSync: typescript.typescriptDefaults.getEagerModelSync(),
        };
      }),
    )
    .toEqual({
      strict: true,
      target: true,
      module: true,
      moduleResolution: 100,
      lib: ["ESNext", "DOM", "DOM.Iterable"],
      eagerModelSync: true,
    });

  await page.evaluate(() => {
    const editor = window.__maldivesEditor;
    editor.setValue(`function greet(name: string) {
  return name.toUpperCase();
}

const message = greet("Maldives");
message;`);
    editor.setPosition({ lineNumber: 5, column: 9 });
    editor.focus();
  });

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__maldivesEditor
          .getModel()
          ?.getAllDecorations()
          .some((decoration) => decoration.options.description === "InlayHint"),
      ),
    )
    .toBe(true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/ts-inlay-hints.png" });
});
