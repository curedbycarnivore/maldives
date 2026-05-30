import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor?: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesReady?: Promise<void>;
  }
}

export async function loadEditor(page: Page, options: { mode?: "read" | "write" } = { mode: "write" }): Promise<void> {
  const mode = options.mode ?? "write";
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(async () => {
      const mounted = await page.evaluate(() => Boolean(window.__maldivesEditor)).catch(() => false);
      if (!mounted) {
        return false;
      }

      await page
        .evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
        .catch(() => undefined);
      return page.evaluate(() => Boolean(window.__maldivesEditor)).catch(() => false);
    }, { timeout: 120000 })
    .toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesReady)).catch(() => false), { timeout: 120000 }).toBe(true);
  await expect(async () => {
    await page.evaluate(() => window.__maldivesReady);
  }).toPass({ timeout: 120000 });

  if (mode === "write") {
    await expect.poll(() => page.locator(".maldives-readwrite-toggle").count()).toBe(1);
    const currentMode = await page.evaluate(() => (window as unknown as { __maldivesWorkspace?: { mode: "read" | "write" } }).__maldivesWorkspace?.mode);

    if (currentMode === "read") {
      await page.locator(".maldives-readwrite-toggle").click();
    }

    await expect.poll(() => page.evaluate(() => (window as unknown as { __maldivesWorkspace?: { mode: "read" | "write" } }).__maldivesWorkspace?.mode)).toBe("write");
    await page.evaluate(() => window.__maldivesEditor?.focus());
  }
}
