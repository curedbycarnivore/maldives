import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("exposes the Maldives Monaco editor", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/");

  await expect
    .poll(() => page.evaluate(() => Boolean(window.__maldivesEditor)))
    .toBe(true);
  await expect(page.evaluate(() => Boolean(window.__monaco))).resolves.toBe(true);

  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toContain("camelCaseWord");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/editor-smoke.png" });
});
