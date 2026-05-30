import { readFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesFileSwitcher: {
      setAdapter(adapter: {
        readFile(path: string): Promise<string>;
        list(dir: string): Promise<Array<{ type: "file" | "directory"; name: string; path: string }>>;
        writeFile(path: string, content: string): Promise<void>;
        watch(path: string, callback: (change: { type: "write"; path: string }) => void): { dispose(): void };
      }): void;
      setRoot(root: string): void;
    };
  }
}

test("P16c quick-open fuzzy matches workspace files and opens the selected real Effect file", async ({ page }) => {
  const stressSource = await readFile("e2e/fixtures/effect-stress-app.tsx", "utf8");
  await loadEditor(page);

  await page.evaluate((source) => {
    const files: Record<string, string> = {
      "/quick-open/src/effect-stress-app.tsx": source,
      "/quick-open/src/boring-helper.ts": "export const boringHelper = true;\n",
    };
    const children: Record<string, Array<{ type: "file" | "directory"; name: string; path: string }>> = {
      "/quick-open": [{ type: "directory", name: "src", path: "/quick-open/src" }],
      "/quick-open/src": [
        { type: "file", name: "boring-helper.ts", path: "/quick-open/src/boring-helper.ts" },
        { type: "file", name: "effect-stress-app.tsx", path: "/quick-open/src/effect-stress-app.tsx" },
      ],
    };

    window.__maldivesFileSwitcher.setAdapter({
      async readFile(path: string) {
        const content = files[path];
        if (content === undefined) throw new Error(`ENOENT: ${path}`);
        return content;
      },
      async list(dir: string) {
        return children[dir] ?? [];
      },
      async writeFile(path: string, content: string) {
        files[path] = content;
      },
      watch() {
        return { dispose() {} };
      },
    });
    window.__maldivesFileSwitcher.setRoot("/quick-open");
  }, stressSource);

  expect(await page.evaluate(() => window.__maldivesExecuteKeybinding("GotoFile"))).toBe(true);
  await page.locator(".maldives-file-switcher").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".maldives-file-switcher-input").fill("stress app");

  const firstItem = page.locator(".maldives-file-switcher-item").first();
  await expect(firstItem).toContainText("effect-stress-app.tsx");
  await expect(firstItem).toContainText("/quick-open/src/effect-stress-app.tsx");
  await expect(page.locator(".maldives-file-switcher-item")).toHaveCount(1);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p16c-quick-open.png" });

  await firstItem.click();
  await expect(page.locator(".maldives-file-switcher")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.toString())).toBe("opfs:/quick-open/src/effect-stress-app.tsx");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("EffectStressDashboard");
});
