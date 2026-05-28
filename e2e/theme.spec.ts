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

test("renders the SSOT theme background and editor typography", async ({ page }) => {
  await loadEditor(page);

  await expect
    .poll(() => page.locator(".monaco-editor .monaco-editor-background").first().evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(45, 45, 45)");

  await expect
    .poll(() => page.locator(".monaco-editor .view-line").first().evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain("JetBrains Mono");

  await expect
    .poll(() => page.locator(".monaco-editor .view-overlays .current-line").first().evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(40, 57, 50)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/theme-proof.png" });
  await page.screenshot({ path: "proof/p5d-color-gaps-proof.png" });
});

test("renders extended SSOT token colors in TypeScript code", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `/** Token documentation */
function tokenFunction(parameter: number) {
  const localVariable = parameter + 1;
  return localVariable;
}

class TokenClass {}
interface TokenInterface { value: number }
type TokenAlias = TokenClass;
const CONSTANT_VALUE = 1;
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/token-colors.ts")));
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 10 });
  });

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("tokenFunction");

  const colorForText = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => normalize(span.textContent) === needle);
      return match ? getComputedStyle(match).color : "";
    }, text);

  await expect.poll(() => colorForText("TokenClass"), { timeout: 10000 }).toBe("rgb(149, 158, 230)");
  await expect.poll(() => colorForText("TokenAlias"), { timeout: 10000 }).toBe("rgb(149, 158, 230)");
  await expect.poll(() => colorForText("+"), { timeout: 10000 }).toBe("rgb(242, 119, 122)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p7a-token-colors-proof.png" });
});
