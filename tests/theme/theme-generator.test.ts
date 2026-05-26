import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseIcls } from "../../src/parsers/icls-parser";
import { MALDIVES_THEME_NAME, toMonacoTheme } from "../../src/theme";

const theme = toMonacoTheme(parseIcls(readFileSync("ssot/colors/active-theme.icls", "utf-8")));

test("exports the Maldives Monaco theme name", () => {
  expect(MALDIVES_THEME_NAME).toBe("maldives");
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
