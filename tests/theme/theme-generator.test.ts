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

test("maps parsed JavaScript tokens to Monaco token rules", () => {
  expect(theme.rules).toEqual([
    { token: "keyword", foreground: "cc8a9b" },
    { token: "comment", foreground: "969696", fontStyle: "italic" },
    { token: "number", foreground: "f99157" },
    { token: "string", foreground: "e2844e" },
    { token: "method", foreground: "74aee8", fontStyle: "bold" },
    { token: "function", foreground: "e3b775" },
  ]);
});

test("registers the generated Monaco theme", () => {
  const defineTheme = vi.fn();
  const monaco = { editor: { defineTheme } } as unknown as typeof import("monaco-editor");

  registerTheme(monaco, config);

  expect(defineTheme).toHaveBeenCalledWith(THEME_NAME, theme);
});
