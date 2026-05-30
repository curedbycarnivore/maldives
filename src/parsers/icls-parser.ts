export interface ConsoleThemeConfig {
  background: string;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  normal: string;
  error: string;
  system: string;
  userInput: string;
  userInputFontStyle: TokenRule["fontStyle"];
  ansi: {
    black?: string;
    blue?: string;
    blueBright?: string;
    cyan?: string;
    cyanBright?: string;
    gray?: string;
    green?: string;
    greenBright?: string;
    magenta?: string;
    magentaBright?: string;
    red?: string;
    redBright?: string;
    white?: string;
    yellow?: string;
    yellowBright?: string;
  };
}

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
  errorOverviewRuler: string;
  warningOverviewRuler: string;
  findMatchBackground: string;
  selectionHighlightBackground: string;
  rightMarginColor: string;
  addedLinesColor: string;
  badCharacterBackground: string;
  badCharacterErrorStripe: string;
  breadcrumbsCurrentForeground: string;
  breadcrumbsCurrentBackground: string;
  breadcrumbsHoveredForeground: string;
  breadcrumbsHoveredBackground: string;
  defaultForeground: string;
  fontFamily: string;
  fontSize: number;
  console: ConsoleThemeConfig;
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
  "ABSTRACT_CLASS_NAME_ATTRIBUTES",
  "BAD_CHARACTER",
  "BRACE_ATTR",
  "BRACKET_ATTR",
  "CLASS_NAME_ATTRIBUTES",
  "CLASS_REFERENCE",
  "BUILDOUT.KEY",
  "BUILDOUT.KEY_VALUE_SEPARATOR",
  "BUILDOUT.LINE_COMMENT",
  "BUILDOUT.SECTION_NAME",
  "BUILDOUT.VALUE",
  "C.KEYWORD",
  "BASH.EXTERNAL_COMMAND",
  "COFFEESCRIPT.BAD_CHARACTER",
  "COFFEESCRIPT.BLOCK_COMMENT",
  "COFFEESCRIPT.BOOLEAN",
  "COFFEESCRIPT.ESCAPE_SEQUENCE",
  "COFFEESCRIPT.EXISTENTIAL",
  "COFFEESCRIPT.EXPRESSIONS_SUBSTITUTION_MARK",
  "COFFEESCRIPT.FUNCTION",
  "COFFEESCRIPT.FUNCTION_BINDING",
  "COFFEESCRIPT.KEYWORD",
  "COFFEESCRIPT.LINE_COMMENT",
  "COFFEESCRIPT.NUMBER",
  "COFFEESCRIPT.OPERATIONS",
  "COFFEESCRIPT.PROTOTYPE",
  "COFFEESCRIPT.REGULAR_EXPRESSION_CONTENT",
  "COFFEESCRIPT.STRING",
  "COFFEESCRIPT.THIS",
  "CPP.BLOCK_COMMENT",
  "CPP.DOT",
  "CPP.KEYWORD",
  "CPP.LINE_COMMENT",
  "CPP.MACROS",
  "CPP.NUMBER",
  "CPP.OPERATION_SIGN",
  "CPP.PP_ARG",
  "CPP.STRING",
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
    errorOverviewRuler: color(optionValue(blockFor(xmlContent, "ERRORS_ATTRIBUTES"), "ERROR_STRIPE_COLOR")),
    warningOverviewRuler: color(optionValue(blockFor(xmlContent, "WARNING_ATTRIBUTES"), "ERROR_STRIPE_COLOR")),
    findMatchBackground: color(optionValue(blockFor(xmlContent, "TEXT_SEARCH_RESULT_ATTRIBUTES"), "BACKGROUND")),
    selectionHighlightBackground: color(optionValue(blockFor(xmlContent, "SEARCH_RESULT_ATTRIBUTES"), "BACKGROUND")),
    rightMarginColor: color(optionValue(xmlContent, "RIGHT_MARGIN_COLOR")),
    addedLinesColor: color(optionValue(xmlContent, "ADDED_LINES_COLOR")),
    badCharacterBackground: color(optionValue(blockFor(xmlContent, "BAD_CHARACTER"), "BACKGROUND")),
    badCharacterErrorStripe: color(optionValue(blockFor(xmlContent, "BAD_CHARACTER"), "ERROR_STRIPE_COLOR")),
    breadcrumbsCurrentForeground: color(optionValue(blockFor(xmlContent, "BREADCRUMBS_CURRENT"), "FOREGROUND")),
    breadcrumbsCurrentBackground: color(optionValue(blockFor(xmlContent, "BREADCRUMBS_CURRENT"), "BACKGROUND")),
    breadcrumbsHoveredForeground: color(optionValue(blockFor(xmlContent, "BREADCRUMBS_HOVERED"), "FOREGROUND")),
    breadcrumbsHoveredBackground: color(optionValue(blockFor(xmlContent, "BREADCRUMBS_HOVERED"), "BACKGROUND")),
    fontFamily: optionValue(fontBlock, "EDITOR_FONT_NAME"),
    fontSize: Number(optionValue(fontBlock, "EDITOR_FONT_SIZE")),
    console: consoleTheme(xmlContent),
    tokens: tokenNames.map((name) => tokenRule(xmlContent, name)),
  };
}

function consoleTheme(xmlContent: string): ConsoleThemeConfig {
  return {
    background: color(optionValue(xmlContent, "CONSOLE_BACKGROUND_KEY")),
    fontFamily: optionValue(xmlContent, "CONSOLE_FONT_NAME"),
    fontSize: Number(optionValue(xmlContent, "CONSOLE_FONT_SIZE")),
    lineSpacing: Number(optionValue(xmlContent, "CONSOLE_LINE_SPACING")),
    normal: color(optionValue(blockFor(xmlContent, "CONSOLE_NORMAL_OUTPUT"), "FOREGROUND")),
    error: color(optionValue(blockFor(xmlContent, "CONSOLE_ERROR_OUTPUT"), "FOREGROUND")),
    system: color(optionValue(blockFor(xmlContent, "CONSOLE_SYSTEM_OUTPUT"), "FOREGROUND")),
    userInput: color(optionValue(blockFor(xmlContent, "CONSOLE_USER_INPUT"), "FOREGROUND")),
    userInputFontStyle: fontStyle(optionValue(blockFor(xmlContent, "CONSOLE_USER_INPUT"), "FONT_TYPE")),
    ansi: {
      black: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_BLACK_OUTPUT"), "FOREGROUND")),
      blue: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_BLUE_OUTPUT"), "FOREGROUND")),
      blueBright: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_BLUE_BRIGHT_OUTPUT"), "FOREGROUND")),
      cyan: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_CYAN_OUTPUT"), "FOREGROUND")),
      cyanBright: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_CYAN_BRIGHT_OUTPUT"), "FOREGROUND")),
      gray: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_GRAY_OUTPUT"), "FOREGROUND")),
      green: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_GREEN_OUTPUT"), "FOREGROUND")),
      greenBright: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_GREEN_BRIGHT_OUTPUT"), "FOREGROUND")),
      magenta: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_MAGENTA_OUTPUT"), "FOREGROUND")),
      magentaBright: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_MAGENTA_BRIGHT_OUTPUT"), "FOREGROUND")),
      red: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_RED_OUTPUT"), "FOREGROUND")),
      redBright: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_RED_BRIGHT_OUTPUT"), "FOREGROUND")),
      white: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_WHITE_OUTPUT"), "FOREGROUND")),
      yellow: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_YELLOW_OUTPUT"), "FOREGROUND")),
      yellowBright: colorOrUndefined(optionValue(blockFor(xmlContent, "CONSOLE_YELLOW_BRIGHT_OUTPUT"), "FOREGROUND")),
    },
  };
}

function tokenRule(xmlContent: string, name: string): TokenRule {
  const tokenBlock = blockFor(xmlContent, name);
  const foreground = colorOrUndefined(optionValue(tokenBlock, "FOREGROUND"));

  return {
    name,
    ...(foreground ? { foreground } : {}),
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

function colorOrUndefined(hex: string): string | undefined {
  return hex ? color(hex) : undefined;
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
