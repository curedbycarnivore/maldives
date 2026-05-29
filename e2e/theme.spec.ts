import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
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

test("renders P15j breadcrumbs variables plus Buildout and C token colors", async ({ page }) => {
  await loadEditor(page);

  const themeVar = (name: string) =>
    page.locator(".monaco-editor").first().evaluate((element, variableName) => getComputedStyle(element).getPropertyValue(variableName).trim(), name);

  await expect.poll(() => themeVar("--vscode-breadcrumb-activeSelectionForeground"), { timeout: 10000 }).toBe("#e4e4e4");
  await expect.poll(() => themeVar("--vscode-breadcrumb-background"), { timeout: 10000 }).toBe("#1f837f");
  await expect.poll(() => themeVar("--vscode-breadcrumb-focusForeground"), { timeout: 10000 }).toBe("#585858");

  await page.evaluate(() => {
    const sample = `[buildout]
parts = app
# managed by Maldives
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "ini", window.__monaco.Uri.parse("file:///maldives/buildout.ts")));
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 1 });
    window.__maldivesEditor.focus();
  });

  const colorForText = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent) === needle);
      return match ? getComputedStyle(match).color : "";
    }, text);

  await expect.poll(() => colorForText("parts"), { timeout: 10000 }).toBe("rgb(204, 153, 204)");
  await expect.poll(() => colorForText("# managed by Maldives"), { timeout: 10000 }).toBe("rgb(153, 153, 153)");

  await page.evaluate(() => {
    const sample = `int main(void) {
  int values[1] = {0};
  return values[0];
}
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "c", window.__monaco.Uri.parse("file:///maldives/p15j.ts")));
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 14 });
    window.__maldivesEditor.focus();
  });

  await expect.poll(() => colorForText("int"), { timeout: 10000 }).toBe("rgb(204, 153, 204)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p15j-theme-brackets-breadcrumbs-class-proof.png" });
});
