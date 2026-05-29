import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

test("declaration build keeps the runtime editor bootable", async ({ page }) => {
  const declaration = await readFile("dist/index.d.ts", "utf-8");
  expect(declaration).toContain("createMaldivesEditor");
  expect(declaration).toContain("EffectDtsFiles");

  await loadEditor(page);
  await expect(page.evaluate(() => window.__maldivesEditor.getValue())).resolves.toContain("camelCaseWord");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p13-declaration-build-proof.png" });
});
