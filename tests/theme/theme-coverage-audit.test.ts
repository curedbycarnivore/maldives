import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseIcls } from "../../src/parsers/icls-parser";
import { auditThemeCoverage, themeCoverageAuditAttributes } from "../../src/theme/coverage-audit";
import { buildMonacoTheme } from "../../src/theme";

const config = parseIcls(readFileSync("ssot/colors/active-theme.icls", "utf-8"));
const monacoTheme = buildMonacoTheme(config);

test("ratchets every classified in-scope ICLS attribute into the Monaco theme", () => {
  expect(themeCoverageAuditAttributes).toEqual([
    "TEXT.BACKGROUND",
    "TEXT.FOREGROUND",
    "GUTTER_BACKGROUND",
    "CARET_ROW_COLOR",
    "FOLDED_TEXT_ATTRIBUTES.BACKGROUND",
    "MATCHED_BRACE_ATTRIBUTES.BACKGROUND",
    "UNMATCHED_BRACE_ATTRIBUTES.FOREGROUND",
    "SELECTION_BACKGROUND",
    "CARET_COLOR",
    "LINE_NUMBERS_COLOR",
    "INDENT_GUIDE",
    "SELECTED_INDENT_GUIDE",
    "WHITESPACES",
    "ERRORS_ATTRIBUTES.EFFECT_COLOR",
    "WARNING_ATTRIBUTES.EFFECT_COLOR",
    "ERRORS_ATTRIBUTES.ERROR_STRIPE_COLOR",
    "WARNING_ATTRIBUTES.ERROR_STRIPE_COLOR",
    "TEXT_SEARCH_RESULT_ATTRIBUTES.BACKGROUND",
    "SEARCH_RESULT_ATTRIBUTES.BACKGROUND",
    "RIGHT_MARGIN_COLOR",
    "ADDED_LINES_COLOR",
    "BAD_CHARACTER.BACKGROUND",
    "BAD_CHARACTER.ERROR_STRIPE_COLOR",
    "BREADCRUMBS_CURRENT.FOREGROUND",
    "BREADCRUMBS_CURRENT.BACKGROUND",
    "BREADCRUMBS_HOVERED.FOREGROUND",
    "EDITOR_FONT_NAME",
    "EDITOR_FONT_SIZE",
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
  ]);

  expect(auditThemeCoverage(config, monacoTheme)).toEqual([]);
});
