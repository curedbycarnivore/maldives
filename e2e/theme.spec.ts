import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesTerminalPanel: { execute(line: string, token?: string): { ok: boolean; output: string } };
  }
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

test("renders remaining SSOT UI colors in the live editor", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(async () => {
    const sample = `function demo() {
  const target = 1;
  if (target) {
    return target;
  }
}
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/ui-colors.ts")));
    window.__maldivesEditor.updateOptions({ renderWhitespace: "all", guides: { indentation: true, bracketPairs: true } });
    window.__maldivesEditor.setPosition({ lineNumber: 4, column: 5 });
    window.__maldivesEditor.focus();
    await window.__maldivesEditor.getAction("actions.find")?.run();
  });

  await page.locator(".find-widget.visible").waitFor({ state: "visible", timeout: 8000 });
  await page.locator(".find-widget.visible .input").first().fill("target");

  await expect
    .poll(() =>
      page.locator(".monaco-editor .core-guide.bracket-indent-guide.vertical").first().evaluate((element) => getComputedStyle(element).boxShadow),
    )
    .toContain("rgb(81, 81, 81)");

  await expect
    .poll(() =>
      page.locator(".monaco-editor .cdr.currentFindMatch").first().evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(255, 204, 102)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p7b-ui-colors-proof.png" });
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

test("renders a compact theme coverage audit sample", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `function coverageAudit() {
  if (true) {
    return "theme";
  }
}
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/theme-audit.ts")));
    window.__maldivesEditor.updateOptions({ rulers: [4], renderWhitespace: "all", guides: { indentation: true, bracketPairs: true } });
    window.__maldivesEditor.setPosition({ lineNumber: 3, column: 5 });
    window.__maldivesEditor.focus();
  });

  await expect
    .poll(() => page.locator(".monaco-editor .view-ruler").first().evaluate((element) => getComputedStyle(element).boxShadow), { timeout: 10000 })
    .toContain("rgb(81, 81, 81)");

  await expect
    .poll(() => page.locator(".monaco-editor .view-overlays .current-line").first().evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(40, 57, 50)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p8-theme-coverage-audit-proof.png" });
});

test("renders P15i font and core theme surface variables for a complex Effect TSX file", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `import { Effect, Layer, Schema, pipe } from "effect";

function traced(_target: unknown, _key: string) {}

@traced
abstract class Repository<T extends { id: string }> {
  abstract load(id: string): Effect.Effect<T, Error>;
}

class UserRepository extends Repository<{ id: string; name: string }> {
  load(id: string) {
    return pipe(
      Effect.succeed({ id, name: "rad" }),
      Effect.map((user) => ({ ...user, label: Schema.String }))
    );
  }
}

const UserLayer = Layer.succeed(Repository, new UserRepository());
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/p15i-real-user.tsx")));
    window.__maldivesEditor.updateOptions({ unicodeHighlight: { nonBasicASCII: true, ambiguousCharacters: true, invisibleCharacters: true } });
    window.__maldivesEditor.setPosition({ lineNumber: 6, column: 16 });
    window.__maldivesEditor.focus();
  });

  await expect
    .poll(() => page.locator(".monaco-editor .view-line").first().evaluate((element) => getComputedStyle(element).fontSize), { timeout: 10000 })
    .toBe("14px");

  const themeVar = (name: string) =>
    page.locator(".monaco-editor").first().evaluate((element, variableName) => getComputedStyle(element).getPropertyValue(variableName).trim(), name);

  await expect.poll(() => themeVar("--vscode-diffEditor-insertedLineBackground"), { timeout: 10000 }).toBe("#e4e4f4");
  await expect.poll(() => themeVar("--vscode-editorUnicodeHighlight-background"), { timeout: 10000 }).toBe("#f2777a");
  await expect.poll(() => themeVar("--vscode-editorUnicodeHighlight-border"), { timeout: 10000 }).toBe("#ff0000");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p15i-theme-core-surfaces-proof.png" });
});

test("reports P15j/P15k/P15l foreign-language colors as no-surface while breadcrumbs remain mapped", async ({ page }) => {
  await loadEditor(page);

  const report = JSON.parse(await readFile("proof/theme-coverage.json", "utf-8")) as {
    top50Unmapped: Array<{ name: string }>;
    classifiedTopLevelOptions: Array<{ name: string; mappedPaths: unknown[]; deferredPaths: Array<{ reason: string }> }>;
  };
  const foreignNames = [
    "BUILDOUT.KEY",
    "BUILDOUT.LINE_COMMENT",
    "C.KEYWORD",
    "APACHE_CONFIG.IDENTIFIER",
    "BASH.EXTERNAL_COMMAND",
    "COFFEESCRIPT.KEYWORD",
    "COFFEESCRIPT.STRING",
  ];

  expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(foreignNames));
  for (const name of foreignNames) {
    const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
    expect(entry?.mappedPaths).toEqual([]);
    expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
  }

  const themeVar = (name: string) =>
    page.locator(".monaco-editor").first().evaluate((element, variableName) => getComputedStyle(element).getPropertyValue(variableName).trim(), name);

  await expect.poll(() => themeVar("--vscode-breadcrumb-activeSelectionForeground"), { timeout: 10000 }).toBe("#e4e4e4");
  await expect.poll(() => themeVar("--vscode-breadcrumb-background"), { timeout: 10000 }).toBe("#1f837f");
  await expect.poll(() => themeVar("--vscode-breadcrumb-focusForeground"), { timeout: 10000 }).toBe("#585858");

  await page.evaluate(() => {
    const sample = `import { Effect, Layer, Schema, pipe } from "effect";

function traced(_target: unknown, _key: string) {}

@traced
class P32ForeignNoSurfaceAudit<T extends { id: string }> {
  render(value: T) {
    return pipe(Effect.succeed(value), Effect.map((row) => Schema.String));
  }
}

export const ForeignNoSurfaceLayer = Layer.succeed(P32ForeignNoSurfaceAudit, new P32ForeignNoSurfaceAudit());
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/p32-foreign-no-surface.tsx")));
    window.__maldivesEditor.setPosition({ lineNumber: 7, column: 5 });
    window.__maldivesEditor.focus();
  });
  await expect(page.locator(".monaco-editor")).toContainText("P32ForeignNoSurfaceAudit");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32j-foreign-language-no-surface-proof.png" });
});

test("renders P32f console palette colors in the terminal panel", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `import { Effect, Layer, Schema, pipe } from "effect";

function traced(_target: unknown, _key: string) {}

@traced
class ConsolePaletteService<T extends { id: string }> {
  run(value: T) {
    return pipe(Effect.succeed(value), Effect.map((item) => Schema.String));
  }
}

export const ConsolePaletteLayer = Layer.succeed(ConsolePaletteService, new ConsolePaletteService());
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/p32f-console-palette.tsx")));
    window.__maldivesEditor.setPosition({ lineNumber: 7, column: 5 });
    window.__maldivesEditor.focus();
  });

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("ActivateTerminalToolWindow"))).toBe(true);
  await page.evaluate(() => window.__maldivesTerminalPanel.execute("echo Effect.gen Layer Schema", "maldives-terminal-session"));
  await page.evaluate(() => window.__maldivesTerminalPanel.execute("rm -rf /", "maldives-terminal-session"));

  const panel = page.locator(".maldives-terminal-panel");
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).backgroundColor), { timeout: 10000 }).toBe("rgb(0, 0, 0)");
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).fontFamily), { timeout: 10000 }).toContain("Source Code Pro");
  await expect.poll(() => page.locator(".maldives-terminal-row-system").first().evaluate((element) => getComputedStyle(element).color)).toBe("rgb(102, 153, 204)");
  await expect.poll(() => page.locator(".maldives-terminal-row-user-input").first().evaluate((element) => getComputedStyle(element).color)).toBe("rgb(153, 204, 153)");
  await expect.poll(() => page.locator(".maldives-terminal-row-user-input").first().evaluate((element) => getComputedStyle(element).fontStyle)).toBe("italic");
  await expect.poll(() => page.locator(".maldives-terminal-row-error").first().evaluate((element) => getComputedStyle(element).color)).toBe("rgb(242, 119, 122)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32f-console-palette-proof.png" });
});

test("reports P32g/P32h C++ and CSS color schemes as no-surface instead of bundled language themes", async ({ page }) => {
  await loadEditor(page);

  const report = JSON.parse(await readFile("proof/theme-coverage.json", "utf-8")) as {
    top50Unmapped: Array<{ name: string }>;
    classifiedTopLevelOptions: Array<{ name: string; mappedPaths: unknown[]; deferredPaths: Array<{ reason: string }> }>;
  };
  const names = [
    "CPP.BLOCK_COMMENT",
    "CPP.KEYWORD",
    "CPP.PP_ARG",
    "CPP.STRING",
    "CSS.COLOR",
    "CSS.COMMENT",
    "CSS.PROPERTY_NAME",
    "CSS.URL",
  ];

  expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(names));
  for (const name of names) {
    const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
    expect(entry?.mappedPaths).toEqual([]);
    expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
  }

  await page.evaluate(() => {
    const sample = `import { Effect, Layer, Schema, pipe } from "effect";

function traced(_target: unknown, _key: string) {}

@traced
class P32CppCssNoSurface<T extends { id: string }> {
  run(value: T) {
    return pipe(Effect.succeed(value), Effect.map((row) => Schema.String));
  }
}

export const P32NoSurfaceLayer = Layer.succeed(P32CppCssNoSurface, new P32CppCssNoSurface());
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/p32-cpp-css-no-surface.tsx")));
    window.__maldivesEditor.setPosition({ lineNumber: 7, column: 5 });
    window.__maldivesEditor.focus();
  });
  await expect(page.locator(".monaco-editor")).toContainText("P32CppCssNoSurface");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32j-cpp-css-no-surface-proof.png" });
});

test("reports P32i custom-language colors as no-surface while the TSX daily-driver remains real", async ({ page }) => {
  await loadEditor(page);

  const report = JSON.parse(await readFile("proof/theme-coverage.json", "utf-8")) as {
    top50Unmapped: Array<{ name: string }>;
    classifiedTopLevelOptions: Array<{ name: string; mappedPaths: unknown[]; deferredPaths: Array<{ reason: string }> }>;
  };
  const customNames = [
    "CUSTOM_INVALID_STRING_ESCAPE_ATTRIBUTES",
    "CUSTOM_KEYWORD1_ATTRIBUTES",
    "CUSTOM_KEYWORD2_ATTRIBUTES",
    "CUSTOM_KEYWORD3_ATTRIBUTES",
    "CUSTOM_KEYWORD4_ATTRIBUTES",
    "CUSTOM_LINE_COMMENT_ATTRIBUTES",
    "CUSTOM_MULTI_LINE_COMMENT_ATTRIBUTES",
    "CUSTOM_NUMBER_ATTRIBUTES",
    "CUSTOM_STRING_ATTRIBUTES",
    "CUSTOM_VALID_STRING_ESCAPE_ATTRIBUTES",
  ];

  expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(customNames));
  for (const name of customNames) {
    const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
    expect(entry?.mappedPaths).toEqual([]);
    expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
  }

  await page.evaluate(() => {
    const sample = `import { Effect, Layer, Schema, pipe } from "effect";

function traced(_target: unknown, _key: string) {}

@traced
class P32iCustomColorAudit<T extends { id: string }> {
  render(value: T) {
    return pipe(Effect.succeed(value), Effect.map((row) => Schema.String));
  }
}

export const P32iLayer = Layer.succeed(P32iCustomColorAudit, new P32iCustomColorAudit());
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "typescript", window.__monaco.Uri.parse("file:///maldives/p32i-custom-color-audit.tsx")));
    window.__maldivesEditor.setPosition({ lineNumber: 7, column: 5 });
    window.__maldivesEditor.focus();
  });
  await expect(page.locator(".monaco-editor")).toContainText("P32iCustomColorAudit");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32i-custom-language-no-surface-proof.png" });
});
