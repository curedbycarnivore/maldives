import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseIcls } from "../../src/parsers/icls-parser";

const theme = parseIcls(readFileSync("ssot/colors/active-theme.icls", "utf-8"));

test("parses editor colors and font from the active ICLS theme", () => {
  expect(theme.background).toBe("#2d2d2d");
  expect(theme.defaultForeground).toBe("#cccccc");
  expect(theme.gutterBackground).toBe("#2D2D2D");
  expect(theme.lineHighlight).toBe("#283932");
  expect(theme.selectionBackground).toBe("#5E404A");
  expect(theme.caretColor).toBe("#D4E3FE");
  expect(theme.lineNumbersColor).toBe("#CCCCCC");
  expect(theme.fontFamily).toBe("JetBrains Mono");
  expect(theme.fontSize).toBe(14);
});

test("parses JavaScript token foregrounds and styles", () => {
  expect(theme.tokens).toEqual([
    { name: "JS.KEYWORD", foreground: "#cc8a9b", fontStyle: "" },
    { name: "JS.LINE_COMMENT", foreground: "#969696", fontStyle: "italic" },
    { name: "JS.NUMBER", foreground: "#f99157", fontStyle: "" },
    { name: "JS.STRING", foreground: "#e2844e", fontStyle: "" },
    { name: "JS.INSTANCE_MEMBER_FUNCTION", foreground: "#74aee8", fontStyle: "bold" },
    { name: "JS.GLOBAL_FUNCTION", foreground: "#e3b775", fontStyle: "" },
  ]);
});
