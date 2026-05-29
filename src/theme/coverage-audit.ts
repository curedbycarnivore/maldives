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
];

export const themeCoverageAuditAttributes = [
  ...colorAuditEntries.map((entry) => entry.iclsAttribute),
  ...editorOptionAuditAttributes,
  ...tokenAuditNames,
];

export function themeCoverageAuditTargets(): Record<string, string[]> {
  const targets = new Map<string, string[]>();

  for (const entry of colorAuditEntries) {
    targets.set(entry.iclsAttribute, entry.monacoColorIds.map((colorId) => `color:${colorId}`));
  }

  targets.set("EDITOR_FONT_NAME", ["option:editor.fontFamily"]);
  targets.set("EDITOR_FONT_SIZE", ["option:editor.fontSize"]);

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
