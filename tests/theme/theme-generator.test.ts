import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import { parseIcls } from "../../src/parsers/icls-parser";
import { THEME_NAME, buildMonacoTheme, registerTheme } from "../../src/theme";

const config = parseIcls(readFileSync("ssot/colors/active-theme.icls", "utf-8"));
const theme = buildMonacoTheme(config);

test("exports the Tomorrow Night Eighties Monaco theme name", () => {
  expect(THEME_NAME).toBe("tomorrow-night-eighties");
});

test("maps editor colors to Monaco theme color ids", () => {
  expect(theme).toMatchObject({
    base: "vs-dark",
    inherit: false,
    colors: {
      "editor.background": "#2d2d2d",
      "editor.foreground": "#cccccc",
      "editorGutter.background": "#2D2D2D",
      "editor.lineHighlightBackground": "#283932",
      "editor.foldBackground": "#18191a",
      "editorBracketMatch.background": "#515151",
      "editorBracketMatch.border": "#515151",
      "editor.selectionBackground": "#5E404A",
      "editorCursor.foreground": "#D4E3FE",
      "editorLineNumber.foreground": "#CCCCCC",
    },
  });
});

test("maps remaining SSOT UI colors to Monaco theme color ids", () => {
  expect(theme.colors).toMatchObject({
    "editorIndentGuide.background": "#515151",
    "editorIndentGuide.background1": "#515151",
    "editorWhitespace.foreground": "#515151",
    "editorError.foreground": "#f2777a",
    "editorWarning.foreground": "#ffcc66",
    "editorOverviewRuler.errorForeground": "#f2777a",
    "editorOverviewRuler.warningForeground": "#ebc700",
    "editor.findMatchBackground": "#ffcc66",
    "editor.selectionHighlightBackground": "#ffcc66",
    "diffEditor.insertedLineBackground": "#E4E4F4",
    "editorUnicodeHighlight.background": "#f2777a",
    "editorUnicodeHighlight.border": "#ff0000",
    "breadcrumb.activeSelectionForeground": "#e4e4e4",
    "breadcrumb.background": "#1f837f",
    "breadcrumb.focusForeground": "#585858",
  });
});

test("maps parsed JavaScript tokens to Monaco token rules", () => {
  expect(theme.rules).toEqual(
    expect.arrayContaining([
      { token: "keyword", foreground: "cc8a9b" },
      { token: "comment", foreground: "969696", fontStyle: "italic" },
      { token: "number", foreground: "f99157" },
      { token: "string", foreground: "e2844e" },
      { token: "method", foreground: "74aee8", fontStyle: "bold" },
      { token: "function", foreground: "e3b775" },
    ]),
  );
});

test("maps the extended ICLS token scheme to Monaco token rules", () => {
  expect(theme.rules).toEqual(
    expect.arrayContaining([
      { token: "function", foreground: "e3b775" },
      { token: "function.call", foreground: "74aee8", fontStyle: "bold" },
      { token: "class", foreground: "e4a38e" },
      { token: "type", foreground: "959ee6" },
      { token: "interface", foreground: "959ee6" },
      { token: "variable", foreground: "959ee6" },
      { token: "parameter", foreground: "99cc99" },
      { token: "operator", foreground: "66cccc" },
      { token: "delimiter", foreground: "f2777a", fontStyle: "italic" },
      { token: "constant", foreground: "cc8a9b", fontStyle: "bold italic" },
      { token: "meta.decorator", foreground: "29b0ab" },
      { token: "decorator", foreground: "e4a38e" },
      { token: "comment.doc", foreground: "969696", fontStyle: "italic" },
      { token: "class.abstract", foreground: "29b0ab", fontStyle: "italic" },
      { token: "invalid", foreground: "ffffff" },
    ]),
  );
});

test("maps P15j bracket and class/reference token surfaces", () => {
  expect(theme.rules).toEqual(
    expect.arrayContaining([
      { token: "delimiter.curly", foreground: "29b0ab", fontStyle: "bold" },
      { token: "delimiter.square", foreground: "29b0ab", fontStyle: "bold" },
      { token: "class.name", foreground: "29b0ab" },
      { token: "class.reference", foreground: "ffcc66" },
    ]),
  );
});

test("does not emit dead token rules or language contributions for foreign-language ICLS schemes", () => {
  const foreignTokenPrefixes = [
    "key.ini",
    "comment.ini",
    "keyword.int",
    "type.identifier.shell",
    "comment.coffee",
    "keyword.class.coffee",
    "comment.cpp",
    "keyword.class.cpp",
    "comment.css",
    "attribute.name.css",
  ];

  expect(theme.rules.map((rule) => rule.token)).not.toEqual(expect.arrayContaining(foreignTokenPrefixes));

  const mainSource = readFileSync("src/main.ts", "utf-8");
  expect(mainSource).not.toContain("basic-languages/coffee");
  expect(mainSource).not.toContain("basic-languages/cpp");
  expect(mainSource).not.toContain("basic-languages/css");
});

test("registers the generated Monaco theme", () => {
  const defineTheme = vi.fn();
  const monaco = { editor: { defineTheme } } as unknown as typeof import("monaco-editor");

  registerTheme(monaco, config);

  expect(defineTheme).toHaveBeenCalledWith(THEME_NAME, theme);
});
