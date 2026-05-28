export interface ThemeConfig {
  background: string;
  gutterBackground: string;
  lineHighlight: string;
  foldedTextBackground: string;
  matchedBraceBackground: string;
  unmatchedBraceForeground: string;
  selectionBackground: string;
  caretColor: string;
  lineNumbersColor: string;
  indentGuide: string;
  selectedIndentGuide: string;
  whitespaceForeground: string;
  errorForeground: string;
  warningForeground: string;
  findMatchBackground: string;
  selectionHighlightBackground: string;
  rightMarginColor: string;
  defaultForeground: string;
  fontFamily: string;
  fontSize: number;
  tokens: TokenRule[];
}

export interface TokenRule {
  name: string;
  foreground?: string;
  fontStyle?: "bold" | "italic" | "bold italic" | "";
}

const tokenNames = [
  "JS.KEYWORD",
  "JS.LINE_COMMENT",
  "JS.NUMBER",
  "JS.STRING",
  "JS.INSTANCE_MEMBER_FUNCTION",
  "JS.GLOBAL_FUNCTION",
  "DEFAULT_FUNCTION_DECLARATION",
  "DEFAULT_FUNCTION_CALL",
  "TS.CLASS",
  "TS.TYPE.ALIAS",
  "DEFAULT_INTERFACE_NAME",
  "JS.LOCAL_VARIABLE",
  "DEFAULT_INSTANCE_FIELD",
  "JS.PARAMETER",
  "DEFAULT_OPERATION_SIGN",
  "DEFAULT_BRACES",
  "DEFAULT_BRACKETS",
  "DEFAULT_PARENTHS",
  "DEFAULT_CONSTANT",
  "DEFAULT_METADATA",
  "TS.DECORATOR",
  "JS.DOC_COMMENT",
];

export function parseIcls(xmlContent: string): ThemeConfig {
  const textBlock = blockFor(xmlContent, "TEXT");
  const fontBlock = xmlContent.match(/<font>([\s\S]*?)<\/font>/)?.[1] ?? "";

  return {
    background: color(optionValue(textBlock, "BACKGROUND")),
    defaultForeground: color(optionValue(textBlock, "FOREGROUND")),
    gutterBackground: color(optionValue(xmlContent, "GUTTER_BACKGROUND")),
    lineHighlight: color(optionValue(xmlContent, "CARET_ROW_COLOR")),
    foldedTextBackground: color(
      optionValue(blockFor(xmlContent, "FOLDED_TEXT_ATTRIBUTES"), "BACKGROUND"),
    ),
    matchedBraceBackground: color(
      optionValue(blockFor(xmlContent, "MATCHED_BRACE_ATTRIBUTES"), "BACKGROUND"),
    ),
    unmatchedBraceForeground: color(
      optionValue(blockFor(xmlContent, "UNMATCHED_BRACE_ATTRIBUTES"), "FOREGROUND"),
    ),
    selectionBackground: color(optionValue(xmlContent, "SELECTION_BACKGROUND")),
    caretColor: color(optionValue(xmlContent, "CARET_COLOR")),
    lineNumbersColor: color(optionValue(xmlContent, "LINE_NUMBERS_COLOR")),
    indentGuide: color(optionValue(xmlContent, "INDENT_GUIDE")),
    selectedIndentGuide: color(optionValue(xmlContent, "SELECTED_INDENT_GUIDE")),
    whitespaceForeground: color(optionValue(xmlContent, "WHITESPACES")),
    errorForeground: color(optionValue(blockFor(xmlContent, "ERRORS_ATTRIBUTES"), "EFFECT_COLOR")),
    warningForeground: color(optionValue(blockFor(xmlContent, "WARNING_ATTRIBUTES"), "EFFECT_COLOR")),
    findMatchBackground: color(optionValue(blockFor(xmlContent, "TEXT_SEARCH_RESULT_ATTRIBUTES"), "BACKGROUND")),
    selectionHighlightBackground: color(optionValue(blockFor(xmlContent, "SEARCH_RESULT_ATTRIBUTES"), "BACKGROUND")),
    rightMarginColor: color(optionValue(xmlContent, "RIGHT_MARGIN_COLOR")),
    fontFamily: optionValue(fontBlock, "EDITOR_FONT_NAME"),
    fontSize: Number(optionValue(fontBlock, "EDITOR_FONT_SIZE")),
    tokens: tokenNames.map((name) => tokenRule(xmlContent, name)),
  };
}

function tokenRule(xmlContent: string, name: string): TokenRule {
  const tokenBlock = blockFor(xmlContent, name);

  return {
    name,
    foreground: color(optionValue(tokenBlock, "FOREGROUND")),
    fontStyle: fontStyle(optionValue(tokenBlock, "FONT_TYPE")),
  };
}

function blockFor(xmlContent: string, name: string): string {
  return xmlContent.match(new RegExp(`<option name="${escapeRegExp(name)}">([\\s\\S]*?)<\\/option>`))?.[1] ?? "";
}

function optionValue(xmlContent: string, name: string): string {
  return xmlContent.match(new RegExp(`<option name="${escapeRegExp(name)}" value="([^"]*)" \\/>`))?.[1] ?? "";
}

function color(hex: string): string {
  return `#${hex}`;
}

function fontStyle(fontType: string): TokenRule["fontStyle"] {
  if (fontType === "1") return "bold";
  if (fontType === "2") return "italic";
  if (fontType === "3") return "bold italic";

  return "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
