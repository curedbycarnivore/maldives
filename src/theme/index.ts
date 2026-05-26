import type { editor } from "monaco-editor";
import type { ThemeConfig, TokenRule } from "../parsers/icls-parser";

export const MALDIVES_THEME_NAME = "maldives";

const tokenScopes: Record<string, string> = {
  "JS.KEYWORD": "keyword",
  "JS.LINE_COMMENT": "comment",
  "JS.NUMBER": "number",
  "JS.STRING": "string",
  "JS.INSTANCE_MEMBER_FUNCTION": "method",
  "JS.GLOBAL_FUNCTION": "function",
};

export function toMonacoTheme(theme: ThemeConfig): editor.IStandaloneThemeData {
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

function toTokenThemeRule(rule: TokenRule): editor.ITokenThemeRule {
  return {
    token: tokenScopes[rule.name] ?? rule.name,
    foreground: rule.foreground?.replace(/^#/, ""),
    ...(rule.fontStyle ? { fontStyle: rule.fontStyle } : {}),
  };
}
