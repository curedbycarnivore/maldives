import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import type * as monaco from "monaco-editor";
import { auditEffectDtsExports, registerEffectDtsFiles } from "../src/typescript-worker";

function readEffectDtsTree(): Record<string, string> {
  const root = join(process.cwd(), "node_modules/effect/dist/dts");
  const files: Record<string, string> = {};

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (path.endsWith(".d.ts")) {
        const rel = relative(root, path).replaceAll("\\", "/");
        files[`/node_modules/effect/dist/dts/${rel}`] = readFileSync(path, "utf-8");
      }
    }
  }

  walk(root);
  return files;
}

function createMonacoStub() {
  const extraLibs: Record<string, { content: string }> = {};

  return {
    typescript: {
      typescriptDefaults: {
        addExtraLib(content: string, filePath = "file:///anonymous.d.ts") {
          extraLibs[filePath] = { content };
          return {
            dispose() {
              delete extraLibs[filePath];
            },
          };
        },
        getExtraLibs() {
          return extraLibs;
        },
      },
    },
  } as unknown as typeof monaco;
}

describe("Effect full declaration export coverage", () => {
  test("covers every real effect/dist/dts declaration and package export path", () => {
    const effectDtsFiles = readEffectDtsTree();
    const packageExports = JSON.parse(readFileSync("node_modules/effect/package.json", "utf-8")).exports;

    const coverage = auditEffectDtsExports(effectDtsFiles, { packageExports });

    expect(Object.keys(effectDtsFiles).length).toBeGreaterThan(300);
    expect(coverage.unmappedDtsFilePaths).toEqual([]);
    expect(coverage.missingExportVirtualPaths).toEqual([]);
    expect(coverage.registeredDtsVirtualPaths).toContain("file:///node_modules/effect/index.d.ts");
    expect(coverage.registeredDtsVirtualPaths).toContain("file:///node_modules/effect/Stream.d.ts");
    expect(coverage.registeredDtsVirtualPaths).toContain("file:///node_modules/effect/internal/layer.d.ts");
    expect(coverage.syntheticDtsVirtualPaths).toContain("file:///node_modules/effect/.index.d.ts");
  });

  test("registers a package.json export map alongside the full declaration tree", () => {
    const monacoStub = createMonacoStub();
    const effectDtsFiles = readEffectDtsTree();
    const packageExports = JSON.parse(readFileSync("node_modules/effect/package.json", "utf-8")).exports;

    const disposable = registerEffectDtsFiles(monacoStub, effectDtsFiles, { packageExports });
    const extraLibs = monacoStub.typescript.typescriptDefaults.getExtraLibs();

    expect(extraLibs["file:///node_modules/effect/package.json"]?.content).toBeDefined();
    const packageJson = JSON.parse(extraLibs["file:///node_modules/effect/package.json"].content);
    expect(packageJson.exports["."].types).toBe("./index.d.ts");
    expect(packageJson.exports["./Stream"].types).toBe("./Stream.d.ts");
    expect(extraLibs["file:///node_modules/effect/Stream.d.ts"]?.content).toContain("fromIterable");
    expect(extraLibs["file:///node_modules/effect/internal/layer.d.ts"]?.content).toBeDefined();
    expect(extraLibs["file:///node_modules/effect/.index.d.ts"]?.content).toBe(extraLibs["file:///node_modules/effect/index.d.ts"]?.content);
    expect(disposable.coverage.missingExportVirtualPaths).toEqual([]);

    disposable.dispose();
    expect(monacoStub.typescript.typescriptDefaults.getExtraLibs()).toEqual({});
  });
});
