import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

interface EffectLsOracleDiagnostic {
  rule: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  message: string;
}

const fixtureSource = readFileSync("e2e/fixtures/effect-parity-corpus.tsx", "utf-8");
const oracle = JSON.parse(readFileSync("proof/p28a2-effect-ls-oracle.json", "utf-8")) as EffectLsOracleDiagnostic[];
const expectedRules = (JSON.parse(readFileSync("e2e/fixtures/effect-parity-corpus.expected.json", "utf-8")) as { expectedRules: string[] }).expectedRules;

test("P28a3 browser Effect diagnostics exactly match the node oracle", async ({ page }) => {
  await loadEditor(page);

  const rendered = await page.evaluate(async ({ source }) => {
    const uri = window.__monaco.Uri.parse("file:///workspace/e2e/fixtures/effect-parity-corpus.tsx");
    const existing = window.__monaco.editor.getModel(uri);
    const model = existing ?? window.__monaco.editor.createModel(source, "typescript", uri);
    model.setValue(source);
    window.__maldivesEditor.setModel(model);
    await window.__maldivesEffectLanguageService.refreshModel(model);
    return window.__maldivesEffectLanguageService.getRenderedDiagnostics(model);
  }, { source: fixtureSource });

  expect(rendered.map((diagnostic) => diagnostic.rule)).toEqual(expect.arrayContaining(expectedRules));
  expect(rendered).toEqual(oracle);

  await expect.poll(() => page.locator(".squiggly-error").count(), { timeout: 15000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.__maldivesEditor.revealLineInCenter(37));

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p28a3-diagnostic-parity.png" });
});
