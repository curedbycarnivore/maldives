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
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor)), { timeout: 15000 }).toBe(true);
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
    editor.setValue(`function add(a: number, b: number) {
  return a + b;
}

const total = add(1, 2);
total;`);
    editor.setPosition({ lineNumber: 5, column: 14 });
    editor.focus();
  });

  // Wait for TS worker to process new model before polling decorations
  await page.waitForTimeout(2000);

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.__maldivesEditor
            .getModel()
            ?.getAllDecorations()
            .filter((decoration) => decoration.options.description === "InlayHint")
            .flatMap((decoration) => [
              decoration.options.before?.content,
              decoration.options.after?.content,
            ])
            .filter((content): content is string => Boolean(content)),
        ),
      { timeout: 10000 },
    )
    .toEqual(expect.arrayContaining(["a:", "b:"]));

  const hintText = await page.evaluate(() =>
    window.__maldivesEditor
      .getModel()
      ?.getAllDecorations()
      .filter((decoration) => decoration.options.description === "InlayHint")
      .flatMap((decoration) => [
        decoration.options.before?.content,
        decoration.options.after?.content,
      ])
      .filter((content): content is string => Boolean(content))
      .join(" ") ?? "",
  );
  expect(hintText).not.toContain("any");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/ts-inlay-hints.png" });
});
