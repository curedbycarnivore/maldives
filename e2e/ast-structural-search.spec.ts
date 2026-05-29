import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const ACTION_ID = "maldives.astGrepSearch";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
  }
}


test("AST Structural Search selects and decorates ast-grep matches", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue([
      "console.log(alpha);",
      "const untouched = beta;",
      "console.log(gamma);",
    ].join("\n"));
    window.prompt = () => "console.log($A)";
  });

  await page.evaluate(async (actionId) => {
    await window.__maldivesEditor.getAction(actionId)?.run();
  }, ACTION_ID);

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__maldivesEditor
          .getSelections()
          ?.map((selection) => window.__maldivesEditor.getModel()?.getValueInRange(selection)),
      ),
    )
    .toEqual(["console.log(alpha)", "console.log(gamma)"]);

  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__maldivesEditor
          .getModel()
          ?.getAllDecorations()
          .filter((decoration) => decoration.options.className === "maldivesAstStructuralSearchMatch").length,
      ),
    )
    .toBe(2);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/ast-structural-search.png" });
});
