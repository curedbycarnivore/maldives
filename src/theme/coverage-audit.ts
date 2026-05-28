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
  { iclsAttribute: "TEXT_SEARCH_RESULT_ATTRIBUTES.BACKGROUND", expected: (theme) => theme.findMatchBackground, monacoColorIds: ["editor.findMatchBackground"] },
  { iclsAttribute: "SEARCH_RESULT_ATTRIBUTES.BACKGROUND", expected: (theme) => theme.selectionHighlightBackground, monacoColorIds: ["editor.selectionHighlightBackground"] },
  { iclsAttribute: "RIGHT_MARGIN_COLOR", expected: (theme) => theme.rightMarginColor, monacoColorIds: ["editorRuler.foreground"] },
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
];

export const themeCoverageAuditAttributes = [
  ...colorAuditEntries.map((entry) => entry.iclsAttribute),
  ...tokenAuditNames,
];

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
