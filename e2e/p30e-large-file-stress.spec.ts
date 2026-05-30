import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const fixturePath = "e2e/fixtures/effect-stress-app.tsx";
const opfsPath = "/p30e/effect-stress-app.tsx";
const source = readFileSync(fixturePath, "utf-8");
const expectedRules = [
  "floatingEffect",
  "missingEffectContext",
  "missingEffectError",
  "missingLayerContext",
  "missingStarInYieldEffectGen",
];

test("P30e loads, diagnoses, edits, saves, and reopens a 300-500 line Effect app through OPFS", async ({ page }) => {
  await loadEditor(page);

  const result = await page.evaluate(async ({ path, sourceText, rules }) => {
    const { OpfsFileSystemAdapter } = await import("/src/fs/opfs-adapter.ts");
    const adapter = new OpfsFileSystemAdapter();
    const loadStarted = performance.now();
    await adapter.writeFile(path, sourceText);

    const reopened = new OpfsFileSystemAdapter();
    const readBack = await reopened.readFile(path);
    const uri = window.__monaco.Uri.parse(`opfs://${path}`);
    const existing = window.__monaco.editor.getModel(uri);
    const model = existing ?? window.__monaco.editor.createModel(readBack, "typescript", uri);
    model.setValue(readBack);
    window.__maldivesEditor.setModel(model);

    const renderedRules = () => window.__maldivesEffectLanguageService
      .getRenderedDiagnostics(model)
      .map((diagnostic) => diagnostic.rule)
      .sort();
    const countByRule = (diagnosticRules: string[]) => diagnosticRules.reduce<Record<string, number>>((counts, rule) => {
      counts[rule] = (counts[rule] ?? 0) + 1;
      return counts;
    }, {});
    const refresh = async () => {
      const started = performance.now();
      await window.__maldivesEffectLanguageService.refreshModel(model);
      return { ms: performance.now() - started, ruleCounts: countByRule(renderedRules()) };
    };

    const initial = await refresh();
    const coldLoadMs = performance.now() - loadStarted;
    const expectedRuleSet = [...rules].sort();
    const actualRuleSet = Object.keys(initial.ruleCounts).filter((rule) => rules.includes(rule)).sort();
    const samples: Array<{ ms: number; ruleCounts: Record<string, number> }> = [initial];

    for (let index = 0; index < 25; index += 1) {
      const line = model.getLineCount();
      const column = model.getLineMaxColumn(line);
      window.__maldivesEditor.executeEdits("p30e-stress", [{
        range: new window.__monaco.Range(line, column, line, column),
        text: `\n// p30e edit/undo storm ${index}`,
      }]);
      samples.push(await refresh());
      window.__maldivesEditor.trigger("p30e-stress", "undo", null);
      samples.push(await refresh());
    }

    await adapter.writeFile(path, model.getValue());
    const savedReadBack = await new OpfsFileSystemAdapter().readFile(path);

    return {
      actualRuleSet,
      coldLoadMs,
      expectedRuleSet,
      finalMatchesFixture: model.getValue() === sourceText,
      maxRefreshMs: Math.max(...samples.map((sample) => sample.ms)),
      readBackMatchesFixture: readBack === sourceText,
      savedReadBackMatchesFixture: savedReadBack === sourceText,
      stable: samples.every((sample) => JSON.stringify(sample.ruleCounts) === JSON.stringify(initial.ruleCounts)),
      totalOperations: (samples.length - 1),
    };
  }, { path: opfsPath, sourceText: source, rules: expectedRules });

  expect(result.readBackMatchesFixture).toBe(true);
  expect(result.savedReadBackMatchesFixture).toBe(true);
  expect(result.finalMatchesFixture).toBe(true);
  expect(result.coldLoadMs).toBeLessThan(5000);
  expect(result.maxRefreshMs).toBeLessThan(2000);
  expect(result.totalOperations).toBe(50);
  expect(result.actualRuleSet).toEqual(result.expectedRuleSet);
  expect(result.stable).toBe(true);

  await page.evaluate(() => window.__maldivesEditor.revealLineInCenter(169));
  await expect(page.locator(".view-line", { hasText: "EffectStressDashboard" }).first()).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => window.__maldivesEditor.revealLineInCenter(241));
  await expect(page.locator(".view-line", { hasText: "missingAuditContextProgram" }).first()).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.locator(".squiggly-error").count(), { timeout: 15000 }).toBeGreaterThan(0);
  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p30e-stress.png" });
});
