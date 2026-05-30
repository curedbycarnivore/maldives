import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const stressSource = readFileSync("e2e/fixtures/effect-stress-app.tsx", "utf-8");
const companionSource = `import { Effect } from "effect";\n\nexport const companionSearchTarget = Effect.succeed("p31a");\n`;

test("P31a searches OPFS project files and opens a real result from the Find tool window", async ({ page }) => {
  await loadEditor(page);

  const setup = await page.evaluate(async ({ stress, companion }) => {
    const { OpfsFileSystemAdapter } = await import("/src/fs/opfs-adapter.ts");
    const adapter = new OpfsFileSystemAdapter();
    await adapter.writeFile("/p31a/src/effect-stress-app.tsx", stress);
    await adapter.writeFile("/p31a/src/companion.ts", companion);
    window.__maldivesFindInFiles.setAdapter(adapter);
    window.__maldivesFindInFiles.setRoot("/p31a");
    return window.__maldivesExecuteKeybinding("ActivateFindToolWindow");
  }, { stress: stressSource, companion: companionSource });

  expect(setup).toBe(true);
  await page.locator(".maldives-find-in-files").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".maldives-find-in-files-input").fill("missingAuditContextProgram");
  await page.locator(".maldives-find-in-files-search").click();

  await expect(page.locator(".maldives-find-in-files-result")).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator(".maldives-find-in-files-result").first()).toContainText("effect-stress-app.tsx");
  await expect(page.locator(".maldives-find-in-files-result").first()).toContainText("missingAuditContextProgram");

  await page.locator(".maldives-find-in-files-result").first().click();
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.toString()), { timeout: 15000 }).toContain("opfs:/p31a/src/effect-stress-app.tsx");
  await expect(page.locator(".view-line", { hasText: "missingAuditContextProgram" }).first()).toBeVisible({ timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p31a-find-in-files.png" });
});
