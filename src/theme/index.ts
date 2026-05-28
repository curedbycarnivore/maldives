import type { editor } from "monaco-editor";
import type { ThemeConfig, TokenRule } from "../parsers/icls-parser";

export const THEME_NAME = "tomorrow-night-eighties";
export const MALDIVES_THEME_NAME = THEME_NAME;

const tokenScopes: Record<string, string[]> = {
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
  "DEFAULT_CONSTANT": ["constant", "variable.constant"],
  "DEFAULT_METADATA": ["meta.decorator"],
  "TS.DECORATOR": ["decorator", "support.type.decorator"],
  "JS.DOC_COMMENT": ["comment.doc", "comment.block.documentation"],
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
      "editor.selectionBackground": theme.selectionBackground,
      "editorCursor.foreground": theme.caretColor,
      "editorLineNumber.foreground": theme.lineNumbersColor,
      "editorIndentGuide.background": theme.indentGuide,
      "editorIndentGuide.background1": theme.indentGuide,
      "editorIndentGuide.activeBackground": theme.indentGuide,
      "editorIndentGuide.activeBackground1": theme.indentGuide,
      "editorBracketPairGuide.background1": theme.indentGuide,
      "editorBracketPairGuide.activeBackground1": theme.indentGuide,
      "editorWhitespace.foreground": theme.whitespaceForeground,
      "editorError.foreground": theme.errorForeground,
      "editorWarning.foreground": theme.warningForeground,
      "editor.findMatchBackground": theme.findMatchBackground,
      "editor.selectionHighlightBackground": theme.selectionHighlightBackground,
    },
    rules: theme.tokens.flatMap(toTokenThemeRules),
  };
}

export const toMonacoTheme = buildMonacoTheme;

export function registerTheme(monaco: typeof import("monaco-editor"), config: ThemeConfig): void {
  monaco.editor.defineTheme(THEME_NAME, buildMonacoTheme(config));
}

function toTokenThemeRules(rule: TokenRule): editor.ITokenThemeRule[] {
  const scopes = tokenScopes[rule.name] ?? [rule.name];

  return scopes.map((scope) => ({
    token: scope,
    foreground: rule.foreground?.replace(/^#/, ""),
    ...(rule.fontStyle ? { fontStyle: rule.fontStyle } : {}),
  }));
}
