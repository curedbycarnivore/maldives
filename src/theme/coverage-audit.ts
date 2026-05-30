import type { editor } from "monaco-editor";
import type { ThemeConfig } from "../parsers/icls-parser";
import { TOKEN_SCOPES } from "./index";

type ColorAuditEntry = {
  iclsAttribute: string;
  expected: (theme: ThemeConfig) => string;
  monacoColorIds: string[];
};

const colorAuditEntries: ColorAuditEntry[] = [
  { iclsAttribute: "TEXT.BACKGROUND", expected: (theme) => theme.background, monacoColorIds: ["editor.background"] },
  { iclsAttribute: "TEXT.FOREGROUND", expected: (theme) => theme.defaultForeground, monacoColorIds: ["editor.foreground"] },
  { iclsAttribute: "GUTTER_BACKGROUND", expected: (theme) => theme.gutterBackground, monacoColorIds: ["editorGutter.background"] },
  { iclsAttribute: "CARET_ROW_COLOR", expected: (theme) => theme.lineHighlight, monacoColorIds: ["editor.lineHighlightBackground"] },
  { iclsAttribute: "FOLDED_TEXT_ATTRIBUTES.BACKGROUND", expected: (theme) => theme.foldedTextBackground, monacoColorIds: ["editor.foldBackground"] },
  { iclsAttribute: "MATCHED_BRACE_ATTRIBUTES.BACKGROUND", expected: (theme) => theme.matchedBraceBackground, monacoColorIds: ["editorBracketMatch.background", "editorBracketMatch.border"] },
  { iclsAttribute: "UNMATCHED_BRACE_ATTRIBUTES.FOREGROUND", expected: (theme) => theme.unmatchedBraceForeground, monacoColorIds: ["editorBracketHighlight.unexpectedBracket.foreground"] },
  { iclsAttribute: "SELECTION_BACKGROUND", expected: (theme) => theme.selectionBackground, monacoColorIds: ["editor.selectionBackground"] },
  { iclsAttribute: "CARET_COLOR", expected: (theme) => theme.caretColor, monacoColorIds: ["editorCursor.foreground"] },
  { iclsAttribute: "LINE_NUMBERS_COLOR", expected: (theme) => theme.lineNumbersColor, monacoColorIds: ["editorLineNumber.foreground"] },
  { iclsAttribute: "INDENT_GUIDE", expected: (theme) => theme.indentGuide, monacoColorIds: ["editorIndentGuide.background", "editorIndentGuide.background1", "editorBracketPairGuide.background1"] },
  { iclsAttribute: "SELECTED_INDENT_GUIDE", expected: (theme) => theme.selectedIndentGuide, monacoColorIds: ["editorIndentGuide.activeBackground", "editorIndentGuide.activeBackground1", "editorBracketPairGuide.activeBackground1"] },
  { iclsAttribute: "WHITESPACES", expected: (theme) => theme.whitespaceForeground, monacoColorIds: ["editorWhitespace.foreground"] },
  { iclsAttribute: "ERRORS_ATTRIBUTES.EFFECT_COLOR", expected: (theme) => theme.errorForeground, monacoColorIds: ["editorError.foreground"] },
  { iclsAttribute: "WARNING_ATTRIBUTES.EFFECT_COLOR", expected: (theme) => theme.warningForeground, monacoColorIds: ["editorWarning.foreground"] },
  { iclsAttribute: "ERRORS_ATTRIBUTES.ERROR_STRIPE_COLOR", expected: (theme) => theme.errorOverviewRuler, monacoColorIds: ["editorOverviewRuler.errorForeground"] },
  { iclsAttribute: "WARNING_ATTRIBUTES.ERROR_STRIPE_COLOR", expected: (theme) => theme.warningOverviewRuler, monacoColorIds: ["editorOverviewRuler.warningForeground"] },
  { iclsAttribute: "TEXT_SEARCH_RESULT_ATTRIBUTES.BACKGROUND", expected: (theme) => theme.findMatchBackground, monacoColorIds: ["editor.findMatchBackground"] },
  { iclsAttribute: "SEARCH_RESULT_ATTRIBUTES.BACKGROUND", expected: (theme) => theme.selectionHighlightBackground, monacoColorIds: ["editor.selectionHighlightBackground"] },
  { iclsAttribute: "RIGHT_MARGIN_COLOR", expected: (theme) => theme.rightMarginColor, monacoColorIds: ["editorRuler.foreground"] },
  { iclsAttribute: "ADDED_LINES_COLOR", expected: (theme) => theme.addedLinesColor, monacoColorIds: ["diffEditor.insertedLineBackground"] },
  { iclsAttribute: "BAD_CHARACTER.BACKGROUND", expected: (theme) => theme.badCharacterBackground, monacoColorIds: ["editorUnicodeHighlight.background"] },
  { iclsAttribute: "BAD_CHARACTER.ERROR_STRIPE_COLOR", expected: (theme) => theme.badCharacterErrorStripe, monacoColorIds: ["editorUnicodeHighlight.border"] },
  { iclsAttribute: "BREADCRUMBS_CURRENT.FOREGROUND", expected: (theme) => theme.breadcrumbsCurrentForeground, monacoColorIds: ["breadcrumb.activeSelectionForeground"] },
  { iclsAttribute: "BREADCRUMBS_CURRENT.BACKGROUND", expected: (theme) => theme.breadcrumbsCurrentBackground, monacoColorIds: ["breadcrumb.background"] },
  { iclsAttribute: "BREADCRUMBS_HOVERED.FOREGROUND", expected: (theme) => theme.breadcrumbsHoveredForeground, monacoColorIds: ["breadcrumb.focusForeground"] },
];

const editorOptionAuditAttributes = ["EDITOR_FONT_NAME", "EDITOR_FONT_SIZE"];

const consoleAuditAttributes = [
  "CONSOLE_BACKGROUND_KEY",
  "CONSOLE_FONT_NAME",
  "CONSOLE_FONT_SIZE",
  "CONSOLE_LINE_SPACING",
  "CONSOLE_BLACK_OUTPUT",
  "CONSOLE_BLUE_BRIGHT_OUTPUT",
  "CONSOLE_BLUE_OUTPUT",
  "CONSOLE_CYAN_BRIGHT_OUTPUT",
  "CONSOLE_CYAN_OUTPUT",
  "CONSOLE_ERROR_OUTPUT",
  "CONSOLE_GRAY_OUTPUT",
  "CONSOLE_GREEN_BRIGHT_OUTPUT",
  "CONSOLE_GREEN_OUTPUT",
  "CONSOLE_MAGENTA_BRIGHT_OUTPUT",
  "CONSOLE_MAGENTA_OUTPUT",
  "CONSOLE_NORMAL_OUTPUT",
  "CONSOLE_RED_BRIGHT_OUTPUT",
  "CONSOLE_RED_OUTPUT",
  "CONSOLE_SYSTEM_OUTPUT",
  "CONSOLE_USER_INPUT",
  "CONSOLE_WHITE_OUTPUT",
  "CONSOLE_YELLOW_BRIGHT_OUTPUT",
  "CONSOLE_YELLOW_OUTPUT",
];

const tokenAuditNames = [
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

export const themeCoverageAuditAttributes = [
  ...colorAuditEntries.map((entry) => entry.iclsAttribute),
  ...editorOptionAuditAttributes,
  ...tokenAuditNames,
  ...consoleAuditAttributes,
];

export function themeCoverageAuditTargets(): Record<string, string[]> {
  const targets = new Map<string, string[]>();

  for (const entry of colorAuditEntries) {
    targets.set(entry.iclsAttribute, entry.monacoColorIds.map((colorId) => `color:${colorId}`));
  }

  targets.set("EDITOR_FONT_NAME", ["option:editor.fontFamily"]);
  targets.set("EDITOR_FONT_SIZE", ["option:editor.fontSize"]);
  targets.set("CONSOLE_BACKGROUND_KEY", ["terminal-css:--maldives-console-background"]);
  targets.set("CONSOLE_FONT_NAME", ["terminal-css:font-family"]);
  targets.set("CONSOLE_FONT_SIZE", ["terminal-css:font-size"]);
  targets.set("CONSOLE_LINE_SPACING", ["terminal-css:--maldives-console-line-spacing"]);
  targets.set("CONSOLE_BLACK_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-black"]);
  targets.set("CONSOLE_BLUE_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-blue"]);
  targets.set("CONSOLE_BLUE_BRIGHT_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-blue-bright"]);
  targets.set("CONSOLE_CYAN_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-cyan"]);
  targets.set("CONSOLE_CYAN_BRIGHT_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-cyan-bright"]);
  targets.set("CONSOLE_ERROR_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-error-output"]);
  targets.set("CONSOLE_GRAY_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-gray"]);
  targets.set("CONSOLE_GREEN_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-green"]);
  targets.set("CONSOLE_GREEN_BRIGHT_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-green-bright"]);
  targets.set("CONSOLE_MAGENTA_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-magenta"]);
  targets.set("CONSOLE_MAGENTA_BRIGHT_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-magenta-bright"]);
  targets.set("CONSOLE_NORMAL_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-normal-output"]);
  targets.set("CONSOLE_RED_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-red"]);
  targets.set("CONSOLE_RED_BRIGHT_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-red-bright"]);
  targets.set("CONSOLE_SYSTEM_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-system-output"]);
  targets.set("CONSOLE_USER_INPUT.FOREGROUND", ["terminal-css:--maldives-console-user-input"]);
  targets.set("CONSOLE_USER_INPUT.FONT_TYPE", ["terminal-css:--maldives-console-user-input-font-style"]);
  targets.set("CONSOLE_WHITE_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-white"]);
  targets.set("CONSOLE_YELLOW_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-yellow"]);
  targets.set("CONSOLE_YELLOW_BRIGHT_OUTPUT.FOREGROUND", ["terminal-css:--maldives-console-yellow-bright"]);

  for (const tokenName of tokenAuditNames) {
    const scopes = TOKEN_SCOPES[tokenName] ?? [tokenName];
    targets.set(`${tokenName}.FOREGROUND`, scopes.map((scope) => `token:${scope}.foreground`));
    targets.set(`${tokenName}.FONT_TYPE`, scopes.map((scope) => `token:${scope}.fontStyle`));
  }

  return Object.fromEntries([...targets.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function auditThemeCoverage(theme: ThemeConfig, monacoTheme: editor.IStandaloneThemeData): string[] {
  const missing: string[] = [];

  for (const entry of colorAuditEntries) {
    const expected = entry.expected(theme);
    for (const colorId of entry.monacoColorIds) {
      if (monacoTheme.colors?.[colorId] !== expected) {
        missing.push(`${entry.iclsAttribute} -> ${colorId}`);
      }
    }
  }

  if (!theme.console.background || !theme.console.normal || !theme.console.error || !theme.console.system || !theme.console.userInput) {
    missing.push("CONSOLE_* -> terminal-css");
  }

  for (const tokenName of tokenAuditNames) {
    const tokenRule = theme.tokens.find((rule) => rule.name === tokenName);
    const expected = tokenRule?.foreground?.replace(/^#/, "");
    const fontStyle = tokenRule?.fontStyle;

    for (const scope of TOKEN_SCOPES[tokenName] ?? [tokenName]) {
      const hasRule = monacoTheme.rules.some(
        (rule) =>
          rule.token === scope &&
          rule.foreground === expected &&
          ((fontStyle && rule.fontStyle === fontStyle) || (!fontStyle && !rule.fontStyle)),
      );

      if (!hasRule) {
        missing.push(`${tokenName} -> ${scope}`);
      }
    }
  }

  return missing;
}
