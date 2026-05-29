import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

test("exposes the Maldives Monaco editor", async ({ page }) => {
  await loadEditor(page);
  await expect(page.evaluate(() => Boolean(window.__monaco))).resolves.toBe(true);

  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toContain("camelCaseWord");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/editor-smoke.png" });
});
