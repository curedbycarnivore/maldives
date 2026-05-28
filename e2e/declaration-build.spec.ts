import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("declaration build keeps the runtime editor bootable", async ({ page }) => {
  const declaration = await readFile("dist/index.d.ts", "utf-8");
  expect(declaration).toContain("createMaldivesEditor");
  expect(declaration).toContain("EffectDtsFiles");

  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);
  await expect(page.evaluate(() => window.__maldivesEditor.getValue())).resolves.toContain("camelCaseWord");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p13-declaration-build-proof.png" });
});
