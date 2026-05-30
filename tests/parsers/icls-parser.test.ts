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

test("parses remaining UI color attributes from the active ICLS theme", () => {
  expect(theme).toMatchObject({
    indentGuide: "#515151",
    whitespaceForeground: "#515151",
    errorForeground: "#f2777a",
    warningForeground: "#ffcc66",
    errorOverviewRuler: "#f2777a",
    warningOverviewRuler: "#ebc700",
    findMatchBackground: "#ffcc66",
    selectionHighlightBackground: "#ffcc66",
  });
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
      { name: "ABSTRACT_CLASS_NAME_ATTRIBUTES", foreground: "#29b0ab", fontStyle: "italic" },
      { name: "BAD_CHARACTER", foreground: "#ffffff", fontStyle: "" },
    ]),
  );
});


test("parses P15i editor UI surface colors from the active ICLS theme", () => {
  expect(theme).toMatchObject({
    addedLinesColor: "#E4E4F4",
    badCharacterBackground: "#f2777a",
    badCharacterErrorStripe: "#ff0000",
  });
});

test("parses P15j breadcrumbs colors from the active ICLS theme", () => {
  expect(theme).toMatchObject({
    breadcrumbsCurrentForeground: "#e4e4e4",
    breadcrumbsCurrentBackground: "#1f837f",
    breadcrumbsHoveredForeground: "#585858",
    breadcrumbsHoveredBackground: "#29b0ab",
  });
});

test("parses P15j bracket, class, Buildout, and C token surfaces", () => {
  expect(theme.tokens).toEqual(
    expect.arrayContaining([
      { name: "BRACE_ATTR", foreground: "#29b0ab", fontStyle: "bold" },
      { name: "BRACKET_ATTR", foreground: "#29b0ab", fontStyle: "bold" },
      { name: "CLASS_NAME_ATTRIBUTES", foreground: "#29b0ab", fontStyle: "" },
      { name: "CLASS_REFERENCE", foreground: "#ffcc66", fontStyle: "" },
      { name: "BUILDOUT.KEY", foreground: "#cc99cc", fontStyle: "bold" },
      { name: "BUILDOUT.KEY_VALUE_SEPARATOR", foreground: "#66cccc", fontStyle: "" },
      { name: "BUILDOUT.LINE_COMMENT", foreground: "#999999", fontStyle: "italic" },
      { name: "BUILDOUT.SECTION_NAME", foreground: "#6699cc", fontStyle: "" },
      { name: "BUILDOUT.VALUE", fontStyle: "bold" },
      { name: "C.KEYWORD", foreground: "#cc99cc", fontStyle: "bold" },
    ]),
  );
});

test("parses P15k shell token surfaces from the active ICLS theme", () => {
  expect(theme.tokens).toEqual(
    expect.arrayContaining([
      { name: "BASH.EXTERNAL_COMMAND", foreground: "#cc8a9b", fontStyle: "" },
    ]),
  );
});

test("parses P15l CoffeeScript token surfaces from the active ICLS theme", () => {
  expect(theme.tokens).toEqual(
    expect.arrayContaining([
      { name: "COFFEESCRIPT.BAD_CHARACTER", foreground: "#ffffff", fontStyle: "" },
      { name: "COFFEESCRIPT.BLOCK_COMMENT", foreground: "#999999", fontStyle: "italic" },
      { name: "COFFEESCRIPT.BOOLEAN", foreground: "#f99157", fontStyle: "bold" },
      { name: "COFFEESCRIPT.ESCAPE_SEQUENCE", foreground: "#6699cc", fontStyle: "" },
      { name: "COFFEESCRIPT.EXISTENTIAL", foreground: "#66cccc", fontStyle: "" },
      { name: "COFFEESCRIPT.EXPRESSIONS_SUBSTITUTION_MARK", foreground: "#ffffff", fontStyle: "" },
      { name: "COFFEESCRIPT.FUNCTION", foreground: "#66cccc", fontStyle: "" },
      { name: "COFFEESCRIPT.FUNCTION_BINDING", foreground: "#66cccc", fontStyle: "" },
      { name: "COFFEESCRIPT.KEYWORD", foreground: "#cc99cc", fontStyle: "" },
      { name: "COFFEESCRIPT.LINE_COMMENT", foreground: "#999999", fontStyle: "italic" },
      { name: "COFFEESCRIPT.NUMBER", foreground: "#f99157", fontStyle: "" },
      { name: "COFFEESCRIPT.OPERATIONS", foreground: "#66cccc", fontStyle: "" },
      { name: "COFFEESCRIPT.PROTOTYPE", foreground: "#66cccc", fontStyle: "" },
      { name: "COFFEESCRIPT.REGULAR_EXPRESSION_CONTENT", foreground: "#f2777a", fontStyle: "" },
      { name: "COFFEESCRIPT.STRING", foreground: "#99cc99", fontStyle: "" },
      { name: "COFFEESCRIPT.THIS", foreground: "#66cccc", fontStyle: "bold" },
    ]),
  );
});

test("parses P32f console palette surfaces from the active ICLS theme", () => {
  expect(theme.console).toMatchObject({
    background: "#000000",
    fontFamily: "Source Code Pro",
    fontSize: 12,
    lineSpacing: 0.8,
    normal: "#cccccc",
    error: "#f2777a",
    system: "#6699cc",
    userInput: "#99cc99",
    userInputFontStyle: "italic",
    ansi: expect.objectContaining({
      black: "#1cbc97",
      blueBright: "#2d61f0",
      cyan: "#66cccc",
      green: "#99cc99",
      magentaBright: "#a47dde",
      redBright: "#ff1616",
      white: "#c9c9c9",
      yellow: "#ffcc66",
    }),
  });
});
