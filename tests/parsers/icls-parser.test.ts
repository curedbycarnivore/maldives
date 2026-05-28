import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseIcls } from "../../src/parsers/icls-parser";

const theme = parseIcls(readFileSync("ssot/colors/active-theme.icls", "utf-8"));

test("parses editor colors and font from the active ICLS theme", () => {
  expect(theme.background).toBe("#2d2d2d");
  expect(theme.defaultForeground).toBe("#cccccc");
  expect(theme.gutterBackground).toBe("#2D2D2D");
  expect(theme.lineHighlight).toBe("#283932");
  expect(theme.foldedTextBackground).toBe("#18191a");
  expect(theme.matchedBraceBackground).toBe("#515151");
  expect(theme.selectionBackground).toBe("#5E404A");
  expect(theme.caretColor).toBe("#D4E3FE");
  expect(theme.lineNumbersColor).toBe("#CCCCCC");
  expect(theme.fontFamily).toBe("JetBrains Mono");
  expect(theme.fontSize).toBe(14);
});

test("parses JavaScript token foregrounds and styles", () => {
  expect(theme.tokens).toEqual(
    expect.arrayContaining([
      { name: "JS.KEYWORD", foreground: "#cc8a9b", fontStyle: "" },
      { name: "JS.LINE_COMMENT", foreground: "#969696", fontStyle: "italic" },
      { name: "JS.NUMBER", foreground: "#f99157", fontStyle: "" },
      { name: "JS.STRING", foreground: "#e2844e", fontStyle: "" },
      { name: "JS.INSTANCE_MEMBER_FUNCTION", foreground: "#74aee8", fontStyle: "bold" },
      { name: "JS.GLOBAL_FUNCTION", foreground: "#e3b775", fontStyle: "" },
    ]),
  );
});

test("parses extended TypeScript token foregrounds from the active ICLS theme", () => {
  expect(theme.tokens).toEqual(
    expect.arrayContaining([
      { name: "DEFAULT_FUNCTION_DECLARATION", foreground: "#e3b775", fontStyle: "" },
      { name: "DEFAULT_FUNCTION_CALL", foreground: "#74aee8", fontStyle: "bold" },
      { name: "TS.CLASS", foreground: "#e4a38e", fontStyle: "" },
      { name: "TS.TYPE.ALIAS", foreground: "#959ee6", fontStyle: "" },
      { name: "DEFAULT_INTERFACE_NAME", foreground: "#959ee6", fontStyle: "" },
      { name: "JS.LOCAL_VARIABLE", foreground: "#959ee6", fontStyle: "" },
      { name: "JS.PARAMETER", foreground: "#99cc99", fontStyle: "" },
      { name: "DEFAULT_OPERATION_SIGN", foreground: "#66cccc", fontStyle: "" },
      { name: "DEFAULT_BRACES", foreground: "#f2777a", fontStyle: "italic" },
      { name: "DEFAULT_CONSTANT", foreground: "#cc8a9b", fontStyle: "bold italic" },
      { name: "DEFAULT_METADATA", foreground: "#29b0ab", fontStyle: "" },
      { name: "TS.DECORATOR", foreground: "#e4a38e", fontStyle: "" },
      { name: "JS.DOC_COMMENT", foreground: "#969696", fontStyle: "italic" },
    ]),
  );
});
