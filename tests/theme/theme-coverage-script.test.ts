import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  auditThemeCoverageMappings,
  extractIclsOptionNames,
  writeThemeCoverageReport,
} from "../../scripts/theme-coverage";

const iclsXml = readFileSync("ssot/colors/active-theme.icls", "utf-8");

describe("scripts/theme-coverage", () => {
  test("diffs every ICLS option name against the mapped Maldives theme attributes", () => {
    const optionNames = extractIclsOptionNames(iclsXml);
    const report = auditThemeCoverageMappings(iclsXml);

    expect(optionNames.totalOptions).toBeGreaterThan(1_000);
    expect(optionNames.uniqueNames).toContain("CARET_COLOR");
    expect(report.mapped).toContain("CARET_COLOR");
    expect(report.mapped).toContain("JS.KEYWORD");
    expect(report.unmapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "DEFAULT_TEMPLATE_LANGUAGE_COLOR", occurrences: 1 }),
      ]),
    );
    expect(report.top50Unmapped).toHaveLength(50);
    expect(report.top50Unmapped[0].occurrences).toBeGreaterThanOrEqual(report.top50Unmapped[49].occurrences);
  });

  test("classifies high-frequency child leaves into Monaco targets or explicit deferrals", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const leafNames = report.classifiedChildLeaves.map((entry) => entry.name);

    expect(leafNames).toEqual(["FOREGROUND", "FONT_TYPE", "EFFECT_TYPE", "BACKGROUND", "EFFECT_COLOR", "ERROR_STRIPE_COLOR"]);
    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(
      expect.arrayContaining(leafNames),
    );
    expect(report.classifiedChildLeaves.find((entry) => entry.name === "FOREGROUND")?.mappedPaths).toEqual(
      expect.arrayContaining([
        { path: "TEXT.FOREGROUND", monacoTargets: ["color:editor.foreground"] },
        { path: "JS.KEYWORD.FOREGROUND", monacoTargets: ["token:keyword.foreground"] },
      ]),
    );
    expect(report.classifiedChildLeaves.find((entry) => entry.name === "ERROR_STRIPE_COLOR")?.mappedPaths).toEqual(
      expect.arrayContaining([
        { path: "ERRORS_ATTRIBUTES.ERROR_STRIPE_COLOR", monacoTargets: ["color:editorOverviewRuler.errorForeground"] },
        { path: "WARNING_ATTRIBUTES.ERROR_STRIPE_COLOR", monacoTargets: ["color:editorOverviewRuler.warningForeground"] },
      ]),
    );
    expect(report.classifiedChildLeaves.find((entry) => entry.name === "EFFECT_TYPE")?.deferredPaths).toEqual(
      expect.arrayContaining([
        {
          path: "DEPRECATED_ATTRIBUTES.EFFECT_TYPE",
          reason: "unsupported: Monaco themes do not expose WebStorm effect-type styles for this attribute",
        },
      ]),
    );
  });

  test("classifies P15i font, UI, and token surfaces into targets or explicit deferrals", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p15iNames = report.classifiedTopLevelOptions.map((entry) => entry.name);

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(
      expect.arrayContaining([
        "EDITOR_FONT_NAME",
        "EDITOR_FONT_SIZE",
        "ABSTRACT_CLASS_NAME_ATTRIBUTES",
        "ADDED_LINES_COLOR",
        "ANNOTATION_NAME_ATTRIBUTES",
        "ANNOTATIONS_COLOR",
        "ANNOTATIONS_MERGED_COLOR",
        "BAD_CHARACTER",
        "BOOKMARKS_ATTRIBUTES",
        "BREAKPOINT_ATTRIBUTES",
      ]),
    );
    expect(p15iNames).toEqual(
      expect.arrayContaining([
        "EDITOR_FONT_NAME",
        "EDITOR_FONT_SIZE",
        "ABSTRACT_CLASS_NAME_ATTRIBUTES",
        "ADDED_LINES_COLOR",
        "ANNOTATION_NAME_ATTRIBUTES",
        "ANNOTATIONS_COLOR",
        "ANNOTATIONS_MERGED_COLOR",
        "BAD_CHARACTER",
        "BOOKMARKS_ATTRIBUTES",
        "BREAKPOINT_ATTRIBUTES",
      ]),
    );
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "ADDED_LINES_COLOR")?.mappedPaths).toEqual([
      {
        path: "ADDED_LINES_COLOR",
        monacoTargets: ["color:diffEditor.insertedLineBackground"],
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BAD_CHARACTER")?.mappedPaths).toEqual(
      expect.arrayContaining([
        { path: "BAD_CHARACTER.FOREGROUND", monacoTargets: ["token:invalid.foreground", "token:invalid.illegal.foreground"] },
        { path: "BAD_CHARACTER.BACKGROUND", monacoTargets: ["color:editorUnicodeHighlight.background"] },
        { path: "BAD_CHARACTER.ERROR_STRIPE_COLOR", monacoTargets: ["color:editorUnicodeHighlight.border"] },
      ]),
    );
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "ANNOTATIONS_COLOR")?.deferredPaths).toEqual([
      { path: "ANNOTATIONS_COLOR", reason: "defer: VCS annotate/blame UI is not implemented in Maldives yet" },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BREAKPOINT_ATTRIBUTES")?.deferredPaths).toEqual([
      {
        path: "BREAKPOINT_ATTRIBUTES",
        reason: "defer: breakpoints require the later debug subsystem before their glyph colors have a live Monaco surface",
      },
    ]);
  });

  test("classifies P15j bracket, breadcrumbs, class/reference, Buildout, and C surfaces", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p15jNames = [
      "BRACE_ATTR",
      "BRACKET_ATTR",
      "BREADCRUMBS_CURRENT",
      "BREADCRUMBS_HOVERED",
      "CLASS_NAME_ATTRIBUTES",
      "CLASS_REFERENCE",
      "BUILDOUT.KEY",
      "BUILDOUT.KEY_VALUE_SEPARATOR",
      "BUILDOUT.LINE_COMMENT",
      "BUILDOUT.SECTION_NAME",
      "BUILDOUT.VALUE",
      "C.KEYWORD",
    ];

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(p15jNames));
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(p15jNames));
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BREADCRUMBS_CURRENT")?.mappedPaths).toEqual(
      expect.arrayContaining([
        { path: "BREADCRUMBS_CURRENT.FOREGROUND", monacoTargets: ["color:breadcrumb.activeSelectionForeground"] },
        { path: "BREADCRUMBS_CURRENT.BACKGROUND", monacoTargets: ["color:breadcrumb.background"] },
      ]),
    );
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BREADCRUMBS_HOVERED")?.deferredPaths).toEqual([
      {
        path: "BREADCRUMBS_HOVERED.BACKGROUND",
        reason: "unsupported: Monaco breadcrumbs expose focus foreground but no separate hovered-item background color",
      },
    ]);
    for (const name of ["C.KEYWORD", "BUILDOUT.KEY", "BUILDOUT.LINE_COMMENT", "BUILDOUT.SECTION_NAME"]) {
      const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
      expect(entry?.mappedPaths).toEqual([]);
      expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
    }
  });

  test("classifies P15k Apache config, Bash, and terminal command token surfaces", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p15kNames = [
      "APACHE_CONFIG.ARG_LEXEM",
      "APACHE_CONFIG.COMMENT",
      "APACHE_CONFIG.IDENTIFIER",
      "BASH.EXTERNAL_COMMAND",
      "BASH.HERE_DOC",
      "BLOCK_TERMINAL_COMMAND",
    ];

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(p15kNames));
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(p15kNames));
    for (const name of ["APACHE_CONFIG.IDENTIFIER", "BASH.EXTERNAL_COMMAND"]) {
      const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
      expect(entry?.mappedPaths).toEqual([]);
      expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
    }
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BASH.HERE_DOC")?.deferredPaths).toEqual([
      {
        path: "BASH.HERE_DOC",
        reason: "no-surface: WebStorm Bash colors have no loaded Maldives language surface; TS/TSX daily-driver tokens are covered separately",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BLOCK_TERMINAL_COMMAND")?.deferredPaths).toEqual([
      {
        path: "BLOCK_TERMINAL_COMMAND.FOREGROUND",
        reason: "defer: terminal command block highlighting waits for the P23 terminal/editor-block subsystem; no Monaco grammar emits this token today",
      },
      {
        path: "BLOCK_TERMINAL_COMMAND.FONT_TYPE",
        reason: "defer: terminal command block highlighting waits for the P23 terminal/editor-block subsystem; no Monaco grammar emits this token today",
      },
    ]);
  });

  test("classifies P15l CoffeeScript token surfaces as no-surface, not dead Monaco rules", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p15lNames = [
      "COFFEESCRIPT.BAD_CHARACTER",
      "COFFEESCRIPT.BLOCK_COMMENT",
      "COFFEESCRIPT.BOOLEAN",
      "COFFEESCRIPT.CLASS_NAME",
      "COFFEESCRIPT.ESCAPE_SEQUENCE",
      "COFFEESCRIPT.EXISTENTIAL",
      "COFFEESCRIPT.EXPRESSIONS_SUBSTITUTION_MARK",
      "COFFEESCRIPT.FUNCTION",
      "COFFEESCRIPT.FUNCTION_BINDING",
      "COFFEESCRIPT.FUNCTION_NAME",
      "COFFEESCRIPT.GLOBAL_VARIABLE",
      "COFFEESCRIPT.HEREDOC_CONTENT",
      "COFFEESCRIPT.HEREDOC_ID",
      "COFFEESCRIPT.HEREGEX_ID",
      "COFFEESCRIPT.JAVASCRIPT_ID",
      "COFFEESCRIPT.KEYWORD",
      "COFFEESCRIPT.LINE_COMMENT",
      "COFFEESCRIPT.LOCAL_VARIABLE",
      "COFFEESCRIPT.NUMBER",
      "COFFEESCRIPT.OBJECT_KEY",
      "COFFEESCRIPT.OPERATIONS",
      "COFFEESCRIPT.PROTOTYPE",
      "COFFEESCRIPT.REGULAR_EXPRESSION_CONTENT",
      "COFFEESCRIPT.REGULAR_EXPRESSION_FLAG",
      "COFFEESCRIPT.REGULAR_EXPRESSION_ID",
      "COFFEESCRIPT.STRING",
      "COFFEESCRIPT.STRING_LITERAL",
      "COFFEESCRIPT.THIS",
    ];

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(p15lNames));
    for (const name of p15lNames) {
      const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
      expect(entry?.mappedPaths).toEqual([]);
      expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
    }
  });

  test("classifies P32g constructor and C++ token surfaces as no-surface, not dead Monaco rules", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p32gNames = [
      "CONSTRUCTOR_CALL_ATTRIBUTES",
      "CONSTRUCTOR_DECLARATION_ATTRIBUTES",
      "CPP.BLOCK_COMMENT",
      "CPP.CONSTANT",
      "CPP.DOT",
      "CPP.FIELD",
      "CPP.FUNCTION",
      "CPP.KEYWORD",
      "CPP.LABEL",
      "CPP.LINE_COMMENT",
      "CPP.MACROS",
      "CPP.METHOD",
      "CPP.NAMESPACE",
      "CPP.NUMBER",
      "CPP.OPERATION_SIGN",
      "CPP.PARAMETER",
      "CPP.PP_ARG",
      "CPP.PP_SKIPPED",
      "CPP.STATIC",
      "CPP.STATIC_FUNCTION",
      "CPP.STRING",
      "CPP.TYPE",
      "CPP.UNUSED",
    ];

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(p32gNames));
    for (const name of p32gNames) {
      const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
      expect(entry?.mappedPaths).toEqual([]);
      expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:") || path.reason.startsWith("unsupported:"))).toBe(true);
    }
  });

  test("classifies P32f console palette surfaces into terminal CSS targets or explicit no-value deferrals", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const consoleNames = [
      "CONSOLE_BACKGROUND_KEY",
      "CONSOLE_BLACK_OUTPUT",
      "CONSOLE_BLUE_BRIGHT_OUTPUT",
      "CONSOLE_BLUE_OUTPUT",
      "CONSOLE_CYAN_BRIGHT_OUTPUT",
      "CONSOLE_CYAN_OUTPUT",
      "CONSOLE_DARKGRAY_OUTPUT",
      "CONSOLE_ERROR_OUTPUT",
      "CONSOLE_FONT_NAME",
      "CONSOLE_FONT_SIZE",
      "CONSOLE_GRAY_OUTPUT",
      "CONSOLE_GREEN_BRIGHT_OUTPUT",
      "CONSOLE_GREEN_OUTPUT",
      "CONSOLE_LINE_SPACING",
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

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(consoleNames));
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(consoleNames));
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CONSOLE_BACKGROUND_KEY")?.mappedPaths).toEqual([
      { path: "CONSOLE_BACKGROUND_KEY", monacoTargets: ["terminal-css:--maldives-console-background"] },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CONSOLE_USER_INPUT")?.mappedPaths).toEqual([
      { path: "CONSOLE_USER_INPUT.FOREGROUND", monacoTargets: ["terminal-css:--maldives-console-user-input"] },
      { path: "CONSOLE_USER_INPUT.FONT_TYPE", monacoTargets: ["terminal-css:--maldives-console-user-input-font-style"] },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CONSOLE_DARKGRAY_OUTPUT")?.deferredPaths).toEqual([
      {
        path: "CONSOLE_DARKGRAY_OUTPUT",
        reason: "unsupported: active ICLS CONSOLE_DARKGRAY_OUTPUT has no foreground or font style to apply",
      },
    ]);
  });

  test("classifies P32h CSS token surfaces as no-surface for the TS/TSX daily-driver", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p32hNames = [
      "CONDITIONALLY_NOT_COMPILED",
      "CSS.COLOR",
      "CSS.COMMENT",
      "CSS.FUNCTION",
      "CSS.IDENT",
      "CSS.IMPORTANT",
      "CSS.KEYWORD",
      "CSS.NUMBER",
      "CSS.OPERATORS",
      "CSS.PROPERTY_NAME",
      "CSS.PROPERTY_VALUE",
      "CSS.STRING",
      "CSS.TAG_NAME",
      "CSS.URL",
    ];

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(p32hNames));
    for (const name of p32hNames) {
      const entry = report.classifiedTopLevelOptions.find((candidate) => candidate.name === name);
      expect(entry?.mappedPaths).toEqual([]);
      expect(entry?.deferredPaths.every((path) => path.reason.startsWith("no-surface:"))).toBe(true);
    }
  });

  test("classifies P32i custom-language token surfaces as explicit no-surface entries", () => {
    const report = auditThemeCoverageMappings(iclsXml);
    const p32iNames = [
      "CUSTOM_INVALID_STRING_ESCAPE_ATTRIBUTES",
      "CUSTOM_KEYWORD1_ATTRIBUTES",
      "CUSTOM_KEYWORD2_ATTRIBUTES",
      "CUSTOM_KEYWORD3_ATTRIBUTES",
      "CUSTOM_KEYWORD4_ATTRIBUTES",
      "CUSTOM_LINE_COMMENT_ATTRIBUTES",
      "CUSTOM_MULTI_LINE_COMMENT_ATTRIBUTES",
      "CUSTOM_NUMBER_ATTRIBUTES",
      "CUSTOM_STRING_ATTRIBUTES",
      "CUSTOM_VALID_STRING_ESCAPE_ATTRIBUTES",
    ];

    expect(report.top50Unmapped.map((entry) => entry.name)).not.toEqual(expect.arrayContaining(p32iNames));
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(p32iNames));
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CUSTOM_KEYWORD1_ATTRIBUTES")?.mappedPaths).toEqual([]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CUSTOM_KEYWORD1_ATTRIBUTES")?.deferredPaths).toEqual([
      {
        path: "CUSTOM_KEYWORD1_ATTRIBUTES.FOREGROUND",
        reason: "no-surface: WebStorm custom file-type keyword colors have no loaded Maldives language surface; TS/TSX daily-driver tokens are covered separately",
      },
      {
        path: "CUSTOM_KEYWORD1_ATTRIBUTES.FONT_TYPE",
        reason: "no-surface: WebStorm custom file-type keyword colors have no loaded Maldives language surface; TS/TSX daily-driver tokens are covered separately",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CUSTOM_INVALID_STRING_ESCAPE_ATTRIBUTES")?.deferredPaths).toEqual([
      {
        path: "CUSTOM_INVALID_STRING_ESCAPE_ATTRIBUTES.FOREGROUND",
        reason: "no-surface: WebStorm custom file-type string escape colors have no loaded Maldives language surface; TS/TSX daily-driver tokens are covered separately",
      },
      {
        path: "CUSTOM_INVALID_STRING_ESCAPE_ATTRIBUTES.BACKGROUND",
        reason: "no-surface: WebStorm custom file-type string escape colors have no loaded Maldives language surface; TS/TSX daily-driver tokens are covered separately",
      },
    ]);
  });

  test("writes proof/theme-coverage.json shaped for watchdog telemetry", () => {
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-theme-coverage-")), "theme-coverage.json");

    writeThemeCoverageReport(iclsXml, outFile);

    const report = JSON.parse(readFileSync(outFile, "utf-8")) as ReturnType<typeof auditThemeCoverageMappings>;
    expect(report.totalOptions).toBeGreaterThan(1_000);
    expect(report.mapped.length).toBeGreaterThan(30);
    expect(report.top50Unmapped).toHaveLength(50);
  });
});
