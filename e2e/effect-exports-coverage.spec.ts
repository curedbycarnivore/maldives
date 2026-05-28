import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const effectDtsFixture = {
  "/node_modules/effect/dist/dts/index.d.ts": 'export * as Stream from "./Stream.js";',
  "/node_modules/effect/dist/dts/Stream.d.ts": `export interface Stream<A, E = never, R = never> { readonly _A: A; readonly _E: E; readonly _R: R; }
export declare const fromIterable: <A>(iterable: Iterable<A>) => Stream<A>;
export declare const runCollect: <A, E = never, R = never>(self: Stream<A, E, R>) => Promise<ReadonlyArray<A>>;`,
};

const effectPackageExports = {
  ".": { types: "./dist/dts/index.d.ts" },
  "./.index": { types: "./dist/dts/.index.d.ts" },
  "./Stream": { types: "./dist/dts/Stream.d.ts" },
  "./package.json": "./package.json",
};

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
    __maldivesRegisterEffectDtsFiles: (
      files: Record<string, string>,
      options?: { packageExports?: Record<string, unknown> },
    ) => { dispose: () => void; coverage: { missingExportVirtualPaths: string[]; syntheticDtsVirtualPaths: string[] } };
  }
}

async function loadEditor(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor)), { timeout: 15000 }).toBe(true);
}

test("full Effect DTS export map resolves Stream root exports and hover signatures", async ({ page }) => {
  await loadEditor(page);
  await page.waitForTimeout(1000);

  const result = await page.evaluate(async ({ files, packageExports }) => {
    const registration = window.__maldivesRegisterEffectDtsFiles(files, { packageExports });

    const sample = `import { Stream } from "effect";\n\nconst stream = Stream.fromIterable([1, 2, 3]);\nconst collected = Stream.runCollect(stream);`;
    const uri = window.__monaco.Uri.parse("file:///maldives/effect-exports-coverage.ts");
    const model = window.__monaco.editor.createModel(sample, "typescript", uri);
    const editor = window.__maldivesEditor;
    editor.setModel(model);

    const runCollectOffset = model.getValue().indexOf("runCollect") + 2;
    const runCollectPosition = model.getPositionAt(runCollectOffset);
    editor.setPosition(runCollectPosition);
    editor.focus();

    const getWorker = await window.__monaco.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker(uri);
    const diagnostics = await worker.getSemanticDiagnostics(uri.toString());
    const quickInfo = await worker.getQuickInfoAtPosition(uri.toString(), runCollectOffset);
    editor.trigger("test", "editor.action.showHover", {});

    return {
      coverage: registration.coverage,
      diagnostics: diagnostics.map((diagnostic) => diagnostic.messageText.toString()),
      quickInfo: quickInfo?.displayParts?.map((part) => part.text).join("") ?? "",
    };
  }, { files: effectDtsFixture, packageExports: effectPackageExports });

  expect(result.coverage.missingExportVirtualPaths).toEqual([]);
  expect(result.coverage.syntheticDtsVirtualPaths).toContain("file:///node_modules/effect/.index.d.ts");
  expect(result.diagnostics.join("\n")).not.toContain("Cannot find module 'effect'");
  expect(result.diagnostics.join("\n")).not.toContain("Cannot find module 'effect/Stream'");
  expect(result.quickInfo).toContain("runCollect");
  expect(result.quickInfo).toContain("Promise");

  await expect(page.locator(".monaco-hover")).toContainText("runCollect", { timeout: 15000 });
  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12e-effect-exports-coverage-proof.png" });
});
