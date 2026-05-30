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
const mandatoryRules = (JSON.parse(readFileSync("e2e/fixtures/effect-parity-corpus.expected.json", "utf-8")) as { expectedRules: string[] }).expectedRules;
const modelPath = "/workspace/e2e/fixtures/effect-parity-corpus.tsx";

const realTriggerSnippetByRule: Record<string, string> = {
  floatingEffect: "Effect.succeed(\"floating\")",
  missingEffectContext: "needsAuditButPromisesNone",
  missingEffectError: "missingErrorButPromisesNever",
  missingLayerContext: "missingLayerContext",
  missingStarInYieldEffectGen: "yield Effect.succeed(\"Ada\")",
};

test("P28d proves each mandatory Effect correctness rule individually against the tsgo oracle", async ({ page }) => {
  await page.route("**/__p28d/effect-tsgo", async (route) => {
    const request = route.request().postDataJSON() as { path: string; content: string };
    expect(request).toEqual({ path: modelPath, content: fixtureSource });
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

  await page.evaluate(async ({ source, modelPath }) => {
    const uri = window.__monaco.Uri.parse(`file://${modelPath}`);
    const existing = window.__monaco.editor.getModel(uri);
    const model = existing ?? window.__monaco.editor.createModel(source, "typescript", uri);
    model.setValue(source);
    window.__maldivesEditor.setModel(model);
    await window.__maldivesEffectLanguageService.refreshModel(model);
    window.__maldivesEffectTsgoDiagnostics.configure({ endpoint: "/__p28d/effect-tsgo", debounceMs: 1 });
    await window.__maldivesEffectTsgoDiagnostics.refreshModel(model);
  }, { source: fixtureSource, modelPath });

  for (const rule of mandatoryRules) {
    const expectedDiagnostics = oracle.filter((diagnostic) => diagnostic.rule === rule);
    expect(expectedDiagnostics, `${rule} must exist in the real oracle`).not.toEqual([]);
    expect(fixtureSource).toContain(realTriggerSnippetByRule[rule]);

    const rendered = await page.evaluate(({ rule }) => {
      const model = window.__maldivesEditor.getModel();
      if (!model) throw new Error("missing active model");
      return {
        languageService: window.__maldivesEffectLanguageService.getRenderedDiagnosticsForRule(model, rule),
        tsgoBridge: window.__maldivesEffectTsgoDiagnostics.getRenderedDiagnosticsForRule(model, rule),
      };
    }, { rule });

    expect(rendered.languageService).toEqual(expectedDiagnostics);
    expect(rendered.tsgoBridge).toEqual(expectedDiagnostics);

    await page.evaluate((line) => window.__maldivesEditor.revealLineInCenter(line), expectedDiagnostics[0].startLine);
    await expect.poll(() => page.locator(".squiggly-error").count(), { timeout: 15000 }).toBeGreaterThan(0);
    await mkdir("proof", { recursive: true });
    await page.screenshot({ path: `proof/p28d-${rule}.png` });
  }
});

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesEffectLanguageService: {
      refreshModel(model: import("monaco-editor").editor.ITextModel): Promise<void>;
      getRenderedDiagnosticsForRule(model: import("monaco-editor").editor.ITextModel, rule: string): OracleDiagnostic[];
    };
    __maldivesEffectTsgoDiagnostics: {
      configure(options: { endpoint: string; debounceMs?: number }): void;
      refreshModel(model: import("monaco-editor").editor.ITextModel): Promise<void>;
      getRenderedDiagnosticsForRule(model: import("monaco-editor").editor.ITextModel, rule: string): OracleDiagnostic[];
    };
  }
}
