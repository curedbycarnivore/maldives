import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

interface OracleDiagnostic {
  rule: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  message: string;
}

const fixtureSource = readFileSync("e2e/fixtures/effect-parity-corpus.tsx", "utf-8");
const oracle = JSON.parse(readFileSync("proof/p28a2-effect-ls-oracle.json", "utf-8")) as OracleDiagnostic[];
const modelPath = "/workspace/e2e/fixtures/effect-parity-corpus.tsx";

test("P28c posts live model content to the Effect tsgo bridge and renders returned markers", async ({ page }) => {
  const bridgeRequests: Array<{ path: string; content: string }> = [];
  await page.route("**/__p28c/effect-tsgo", async (route) => {
    const request = route.request().postDataJSON() as { path: string; content: string };
    bridgeRequests.push(request);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        diagnostics: oracle.map((diagnostic) => ({
          path: request.path,
          severity: "error",
          code: "TS9999",
          ...diagnostic,
        })),
      }),
    });
  });

  await loadEditor(page);

  const rendered = await page.evaluate(async ({ source, modelPath }) => {
    const uri = window.__monaco.Uri.parse(`file://${modelPath}`);
    const existing = window.__monaco.editor.getModel(uri);
    const model = existing ?? window.__monaco.editor.createModel(source, "typescript", uri);
    model.setValue(source);
    window.__maldivesEditor.setModel(model);
    window.__maldivesEffectTsgoDiagnostics.configure({ endpoint: "/__p28c/effect-tsgo", debounceMs: 1 });
    await window.__maldivesEffectTsgoDiagnostics.refreshModel(model);
    window.__maldivesEditor.revealLineInCenter(37);
    return window.__maldivesEffectTsgoDiagnostics.getRenderedDiagnostics(model);
  }, { source: fixtureSource, modelPath });

  expect(bridgeRequests).toEqual([{ path: modelPath, content: fixtureSource }]);
  expect(rendered).toEqual(oracle);
  await expect.poll(() => page.locator(".squiggly-error").count(), { timeout: 15000 }).toBeGreaterThan(0);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p28c-effect-tsgo-markers.png" });
});

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesEffectTsgoDiagnostics: {
      configure(options: { endpoint: string; debounceMs?: number }): void;
      refreshModel(model: import("monaco-editor").editor.ITextModel): Promise<void>;
      getRenderedDiagnostics(model: import("monaco-editor").editor.ITextModel): OracleDiagnostic[];
    };
  }
}
