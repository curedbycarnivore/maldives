import { mkdir } from "node:fs/promises";
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

test("renders P15k Bash external command colors on a real shell workflow", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `#!/usr/bin/env bash
set -euo pipefail
mkdir -p src/generated
cat > src/generated/real-user.tsx <<'TSX'
import { Effect, Layer, Schema, pipe } from "effect";

function traced(_target: unknown, _key: string) {}

@traced
class Repository<T extends { id: string }> {
  load(id: string): Effect.Effect<T, Error> {
    return pipe(
      Effect.succeed({ id, schema: Schema.String }),
      Effect.map((value) => value as T)
    );
  }
}

const LiveRepository = Layer.succeed(Repository, new Repository<{ id: string }>());
TSX
grep -n "LiveRepository" src/generated/real-user.tsx
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "shell", window.__monaco.Uri.parse("file:///maldives/p15k-real-workflow.ts")));
    window.__maldivesEditor.setPosition({ lineNumber: 4, column: 1 });
    window.__maldivesEditor.focus();
  });

  const colorForText = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent) === needle);
      return match ? getComputedStyle(match).color : "";
    }, text);

  await expect.poll(() => colorForText("mkdir"), { timeout: 10000 }).toBe("rgb(204, 138, 155)");
  await expect.poll(() => colorForText("cat"), { timeout: 10000 }).toBe("rgb(204, 138, 155)");
  await expect.poll(() => colorForText("grep"), { timeout: 10000 }).toBe("rgb(204, 138, 155)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p15k-theme-shell-surfaces-proof.png" });
});

test("renders P15l CoffeeScript token colors on a real script that emits Effect TSX", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `# CoffeeScript generator for a real Effect TSX module
class RepositoryBuilder
  constructor: (@ready = true) ->
  build: (id) =>
    source = """
    import { Effect, Layer, Schema, pipe } from "effect"
    class Repository<T extends { id: string }> {
      load(id: string) { return pipe(Effect.succeed({ id }), Effect.map(Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String })))) }
    }
    export const Live = Layer.succeed(Repository, new Repository<{ id: string }>())
    """
    count = 42
    return source if this.ready? and count > 0
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "coffeescript", window.__monaco.Uri.parse("file:///maldives/p15l-real-generator.coffee")));
    window.__maldivesEditor.setPosition({ lineNumber: 3, column: 3 });
    window.__maldivesEditor.focus();
  });

  const colorForText = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent) === needle);
      if (match) return getComputedStyle(match).color;

      const line = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line")).find(
        (viewLine) => normalize(viewLine.textContent) === needle,
      );
      const leafColors = Array.from(line?.querySelectorAll<HTMLElement>("span") ?? [])
        .filter((span) => span.childElementCount === 0 && normalize(span.textContent))
        .map((span) => getComputedStyle(span).color);
      return new Set(leafColors).size === 1 ? leafColors[0] : "";
    }, text);

  await expect.poll(() => colorForText("# CoffeeScript generator for a real Effect TSX module"), { timeout: 10000 }).toBe("rgb(153, 153, 153)");
  await expect.poll(() => colorForText("class"), { timeout: 10000 }).toBe("rgb(204, 153, 204)");
  await expect.poll(() => colorForText("true"), { timeout: 10000 }).toBe("rgb(249, 145, 87)");
  await expect.poll(() => colorForText("->"), { timeout: 10000 }).toBe("rgb(102, 204, 204)");
  await expect.poll(() => colorForText("this"), { timeout: 10000 }).toBe("rgb(102, 204, 204)");
  await expect.poll(() => colorForText("42"), { timeout: 10000 }).toBe("rgb(249, 145, 87)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p15l-theme-coffeescript-surfaces-proof.png" });
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

test("renders P32g C++ token colors on a real bridge that embeds Effect TSX", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `/* P32g C++ renders a real Effect TSX bridge */
#include <effect/runtime.hpp>
#define EFFECT_BATCH_SIZE 42
namespace maldives::effect {
template <class Row>
class EffectRepository {
public:
  EffectRepository(Row row) : row_(row) {}
  std::string emitTsx() const {
    return "Effect.gen(function* () { return yield* Layer.succeed(Schema.String, pipe(Effect.succeed(row.id))) })";
  }
private:
  Row row_;
};
}
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "cpp", window.__monaco.Uri.parse("file:///maldives/p32g-effect-bridge.cpp")));
    window.__maldivesEditor.setPosition({ lineNumber: 8, column: 3 });
    window.__maldivesEditor.focus();
  });

  const colorForText = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent) === needle);
      return match ? getComputedStyle(match).color : "";
    }, text);
  const colorForSpanContaining = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent).includes(needle));
      return match ? getComputedStyle(match).color : "";
    }, text);

  await expect.poll(() => colorForText("/* P32g C++ renders a real Effect TSX bridge */"), { timeout: 10000 }).toBe("rgb(153, 153, 153)");
  await expect.poll(() => colorForText("class"), { timeout: 10000 }).toBe("rgb(204, 153, 204)");
  await expect.poll(() => colorForText("#define"), { timeout: 10000 }).toBe("rgb(242, 119, 122)");
  await expect.poll(() => colorForText("effect/runtime.hpp"), { timeout: 10000 }).toBe("rgb(249, 145, 87)");
  await expect.poll(() => colorForText("42"), { timeout: 10000 }).toBe("rgb(249, 145, 87)");
  await expect.poll(() => colorForSpanContaining("Effect.gen(function*"), { timeout: 10000 }).toBe("rgb(153, 204, 153)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32g-cpp-theme-proof.png" });
});

test("renders P32h CSS token colors on a real stylesheet for an Effect TSX shell", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const sample = `/* P32h CSS skins a real Effect TSX shell */
@media screen and (min-width: 768px) {
  .effect-workbench[data-state="ready"] {
    color: #cccccc;
    background-image: url("/assets/effect-layer.svg");
    margin: calc(100% - 42px) !important;
  }
}
`;
    window.__maldivesEditor.setModel(window.__monaco.editor.createModel(sample, "css", window.__monaco.Uri.parse("file:///maldives/p32h-effect-workbench.css")));
    window.__maldivesEditor.setPosition({ lineNumber: 5, column: 5 });
    window.__maldivesEditor.focus();
  });

  const colorForText = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent) === needle);
      return match ? getComputedStyle(match).color : "";
    }, text);
  const colorForSpanContaining = (text: string) =>
    page.evaluate((needle) => {
      const normalize = (value: string | null) => (value ?? "").replace(/\u00a0/g, " ").trim();
      const spans = Array.from(document.querySelectorAll<HTMLElement>(".monaco-editor .view-line span"));
      const match = spans.find((span) => span.childElementCount === 0 && normalize(span.textContent).includes(needle));
      return match ? getComputedStyle(match).color : "";
    }, text);

  await expect.poll(() => colorForText("/* P32h CSS skins a real Effect TSX shell */"), { timeout: 10000 }).toBe("rgb(153, 153, 153)");
  await expect.poll(() => colorForText("media"), { timeout: 10000 }).toBe("rgb(255, 204, 102)");
  await expect.poll(() => colorForText("color:"), { timeout: 10000 }).toBe("rgb(153, 204, 153)");
  await expect.poll(() => colorForText("#cccccc"), { timeout: 10000 }).toBe("rgb(204, 204, 204)");
  await expect.poll(() => colorForSpanContaining("42"), { timeout: 10000 }).toBe("rgb(249, 145, 87)");
  await expect.poll(() => colorForText("!important"), { timeout: 10000 }).toBe("rgb(242, 119, 122)");
  await expect.poll(() => colorForSpanContaining("/assets/effect-layer.svg"), { timeout: 10000 }).toBe("rgb(255, 204, 102)");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p32h-css-theme-proof.png" });
});
