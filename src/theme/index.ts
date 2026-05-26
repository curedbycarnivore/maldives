import type { editor } from "monaco-editor";
import type { ThemeConfig, TokenRule } from "../parsers/icls-parser";

export const THEME_NAME = "tomorrow-night-eighties";
export const MALDIVES_THEME_NAME = THEME_NAME;

const tokenScopes: Record<string, string> = {
  "JS.KEYWORD": "keyword",
  "JS.LINE_COMMENT": "comment",
  "JS.NUMBER": "number",
  "JS.STRING": "string",
  "JS.INSTANCE_MEMBER_FUNCTION": "method",
  "JS.GLOBAL_FUNCTION": "function",
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
      "editor.selectionBackground": theme.selectionBackground,
      "editorCursor.foreground": theme.caretColor,
      "editorLineNumber.foreground": theme.lineNumbersColor,
    },
    rules: theme.tokens.map(toTokenThemeRule),
  };
}

export const toMonacoTheme = buildMonacoTheme;

export function registerTheme(monaco: typeof import("monaco-editor"), config: ThemeConfig): void {
  monaco.editor.defineTheme(THEME_NAME, buildMonacoTheme(config));
}

function toTokenThemeRule(rule: TokenRule): editor.ITokenThemeRule {
  return {
    token: tokenScopes[rule.name] ?? rule.name,
    foreground: rule.foreground?.replace(/^#/, ""),
    ...(rule.fontStyle ? { fontStyle: rule.fontStyle } : {}),
  };
}
