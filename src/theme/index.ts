import type { editor } from "monaco-editor";
import type { ThemeConfig, TokenRule } from "../parsers/icls-parser";

export const THEME_NAME = "tomorrow-night-eighties";
export const MALDIVES_THEME_NAME = THEME_NAME;

export const TOKEN_SCOPES: Record<string, string[]> = {
  "JS.KEYWORD": ["keyword"],
  "JS.LINE_COMMENT": ["comment"],
  "JS.NUMBER": ["number"],
  "JS.STRING": ["string"],
  "JS.INSTANCE_MEMBER_FUNCTION": ["method"],
  "JS.GLOBAL_FUNCTION": ["function"],
  "DEFAULT_FUNCTION_DECLARATION": ["function", "entity.name.function"],
  "DEFAULT_FUNCTION_CALL": ["function.call", "support.function"],
  "TS.CLASS": ["class", "entity.name.type.class"],
  "TS.TYPE.ALIAS": ["type", "entity.name.type"],
  "DEFAULT_INTERFACE_NAME": ["interface", "entity.name.type.interface"],
  "JS.LOCAL_VARIABLE": ["variable"],
  "DEFAULT_INSTANCE_FIELD": ["variable.member", "property"],
  "JS.PARAMETER": ["parameter", "variable.parameter"],
  "DEFAULT_OPERATION_SIGN": ["operator", "keyword.operator"],
  "DEFAULT_BRACES": ["delimiter", "delimiter.bracket"],
  "DEFAULT_BRACKETS": ["delimiter.array"],
  "DEFAULT_PARENTHS": ["delimiter.parenthesis"],
  "DEFAULT_CONSTANT": ["constant", "variable.constant"],
  "DEFAULT_METADATA": ["meta.decorator"],
  "TS.DECORATOR": ["decorator", "support.type.decorator"],
  "JS.DOC_COMMENT": ["comment.doc", "comment.block.documentation"],
  "ABSTRACT_CLASS_NAME_ATTRIBUTES": ["class.abstract", "entity.name.type.class.abstract"],
  "BAD_CHARACTER": ["invalid", "invalid.illegal"],
  "BRACE_ATTR": ["delimiter.curly"],
  "BRACKET_ATTR": ["delimiter.square"],
  "CLASS_NAME_ATTRIBUTES": ["class.name", "entity.name.type.class.name"],
  "CLASS_REFERENCE": ["class.reference", "support.class.reference"],
  "BUILDOUT.KEY": ["key.ini"],
  "BUILDOUT.KEY_VALUE_SEPARATOR": ["delimiter.ini"],
  "BUILDOUT.LINE_COMMENT": ["comment.ini"],
  "BUILDOUT.SECTION_NAME": ["metatag.ini"],
  "BUILDOUT.VALUE": ["string.ini"],
  "C.KEYWORD": ["keyword.int", "keyword.void", "keyword.return"],
  "BASH.EXTERNAL_COMMAND": ["type.identifier.shell"],
};

export function buildMonacoTheme(theme: ThemeConfig): editor.IStandaloneThemeData {
  return {
    base: "vs-dark",
    inherit: false,
    colors: {
      "editor.background": theme.background,
      "editor.foreground": theme.defaultForeground,
      "editorGutter.background": theme.gutterBackground,
      "editor.lineHighlightBackground": theme.lineHighlight,
      "editor.foldBackground": theme.foldedTextBackground,
      "editorBracketMatch.background": theme.matchedBraceBackground,
      "editorBracketMatch.border": theme.matchedBraceBackground,
      "editorBracketHighlight.unexpectedBracket.foreground": theme.unmatchedBraceForeground,
      "editor.selectionBackground": theme.selectionBackground,
      "editorCursor.foreground": theme.caretColor,
      "editorLineNumber.foreground": theme.lineNumbersColor,
      "editorIndentGuide.background": theme.indentGuide,
      "editorIndentGuide.background1": theme.indentGuide,
      "editorIndentGuide.activeBackground": theme.selectedIndentGuide,
      "editorIndentGuide.activeBackground1": theme.selectedIndentGuide,
      "editorBracketPairGuide.background1": theme.indentGuide,
      "editorBracketPairGuide.activeBackground1": theme.selectedIndentGuide,
      "editorWhitespace.foreground": theme.whitespaceForeground,
      "editorError.foreground": theme.errorForeground,
      "editorWarning.foreground": theme.warningForeground,
      "editorOverviewRuler.errorForeground": theme.errorOverviewRuler,
      "editorOverviewRuler.warningForeground": theme.warningOverviewRuler,
      "editor.findMatchBackground": theme.findMatchBackground,
      "editor.selectionHighlightBackground": theme.selectionHighlightBackground,
      "editorRuler.foreground": theme.rightMarginColor,
      "diffEditor.insertedLineBackground": theme.addedLinesColor,
      "editorUnicodeHighlight.background": theme.badCharacterBackground,
      "editorUnicodeHighlight.border": theme.badCharacterErrorStripe,
      "breadcrumb.activeSelectionForeground": theme.breadcrumbsCurrentForeground,
      "breadcrumb.background": theme.breadcrumbsCurrentBackground,
      "breadcrumb.focusForeground": theme.breadcrumbsHoveredForeground,
    },
    rules: theme.tokens.flatMap(toTokenThemeRules),
  };
}

export const toMonacoTheme = buildMonacoTheme;

export function registerTheme(monaco: typeof import("monaco-editor"), config: ThemeConfig): void {
  monaco.editor.defineTheme(THEME_NAME, buildMonacoTheme(config));
}

function toTokenThemeRules(rule: TokenRule): editor.ITokenThemeRule[] {
  const scopes = TOKEN_SCOPES[rule.name] ?? [rule.name];

  return scopes.map((scope) => ({
    token: scope,
    foreground: rule.foreground?.replace(/^#/, ""),
    ...(rule.fontStyle ? { fontStyle: rule.fontStyle } : {}),
  }));
}
