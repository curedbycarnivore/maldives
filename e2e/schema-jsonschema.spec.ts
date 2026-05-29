import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";


test("Schema to JSONSchema editor command inserts a generated schema comment", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const source = `import { Schema } from "effect";\n\nconst User = Schema.Struct({\n  name: Schema.String,\n  count: Schema.Number,\n});\n`;
    const editor = window.__maldivesEditor;
    const model = editor.getModel();
    editor.setValue(source);
    const start = source.indexOf("Schema.Struct");
    const end = source.indexOf(";", start);
    const startPosition = model!.getPositionAt(start);
    const endPosition = model!.getPositionAt(end);
    editor.setSelection({
      startLineNumber: startPosition.lineNumber,
      startColumn: startPosition.column,
      endLineNumber: endPosition.lineNumber,
      endColumn: endPosition.column,
    });
  });

  page.once("dialog", async (dialog) => {
    await dialog.accept("draft-07");
  });

  const ran = await page.evaluate(async () => {
    const action = window.__maldivesEditor.getAction("maldives.schemaToJsonSchema");
    await action?.run();
    return Boolean(action);
  });

  expect(ran).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("Schema → JSONSchema (draft-07)");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain('"name": {');
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain('"count"');

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p11e-schema-jsonschema-proof.png" });
});
