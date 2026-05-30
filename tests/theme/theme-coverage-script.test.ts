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
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "C.KEYWORD")?.mappedPaths).toEqual([
      {
        path: "C.KEYWORD.FOREGROUND",
        monacoTargets: ["token:keyword.int.foreground", "token:keyword.void.foreground", "token:keyword.return.foreground"],
      },
      {
        path: "C.KEYWORD.FONT_TYPE",
        monacoTargets: ["token:keyword.int.fontStyle", "token:keyword.void.fontStyle", "token:keyword.return.fontStyle"],
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BUILDOUT.KEY")?.mappedPaths).toEqual(
      expect.arrayContaining([{ path: "BUILDOUT.KEY.FOREGROUND", monacoTargets: ["token:key.ini.foreground"] }]),
    );
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
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BASH.EXTERNAL_COMMAND")?.mappedPaths).toEqual([
      {
        path: "BASH.EXTERNAL_COMMAND.FOREGROUND",
        monacoTargets: ["token:type.identifier.shell.foreground"],
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "APACHE_CONFIG.IDENTIFIER")?.deferredPaths).toEqual([
      {
        path: "APACHE_CONFIG.IDENTIFIER.FOREGROUND",
        reason: "defer: Monaco/Maldives does not load an Apache config language grammar yet",
      },
      {
        path: "APACHE_CONFIG.IDENTIFIER.FONT_TYPE",
        reason: "defer: Monaco/Maldives does not load an Apache config language grammar yet",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "BASH.HERE_DOC")?.deferredPaths).toEqual([
      {
        path: "BASH.HERE_DOC",
        reason: "unsupported: active ICLS BASH.HERE_DOC has no foreground or font style to apply",
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

  test("classifies P15l CoffeeScript token surfaces into targets or explicit deferrals", () => {
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
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(p15lNames));
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "COFFEESCRIPT.KEYWORD")?.mappedPaths).toEqual([
      {
        path: "COFFEESCRIPT.KEYWORD.FOREGROUND",
        monacoTargets: expect.arrayContaining([
          "token:keyword.class.coffee.foreground",
          "token:keyword.return.coffee.foreground",
          "token:keyword.if.coffee.foreground",
        ]),
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "COFFEESCRIPT.CLASS_NAME")?.deferredPaths).toEqual([
      {
        path: "COFFEESCRIPT.CLASS_NAME.FOREGROUND",
        reason: "unsupported: Monaco's CoffeeScript grammar does not emit a distinct class-name token",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "COFFEESCRIPT.JAVASCRIPT_ID")?.deferredPaths).toEqual(
      expect.arrayContaining([
        {
          path: "COFFEESCRIPT.JAVASCRIPT_ID.BACKGROUND",
          reason: "unsupported: Monaco token theme rules do not expose per-token backgrounds for this attribute",
        },
      ]),
    );
  });

  test("classifies P32g constructor and C++ token surfaces into targets or explicit no-surface deferrals", () => {
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
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(p32gNames));
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CPP.KEYWORD")?.mappedPaths).toEqual([
      {
        path: "CPP.KEYWORD.FOREGROUND",
        monacoTargets: expect.arrayContaining([
          "token:keyword.class.cpp.foreground",
          "token:keyword.return.cpp.foreground",
          "token:keyword.namespace.cpp.foreground",
        ]),
      },
      {
        path: "CPP.KEYWORD.FONT_TYPE",
        monacoTargets: expect.arrayContaining([
          "token:keyword.class.cpp.fontStyle",
          "token:keyword.return.cpp.fontStyle",
          "token:keyword.namespace.cpp.fontStyle",
        ]),
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CPP.PP_ARG")?.mappedPaths).toEqual([
      { path: "CPP.PP_ARG.FOREGROUND", monacoTargets: ["token:string.include.identifier.cpp.foreground"] },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CONSTRUCTOR_CALL_ATTRIBUTES")?.deferredPaths).toEqual([
      {
        path: "CONSTRUCTOR_CALL_ATTRIBUTES.FOREGROUND",
        reason: "unsupported: Monaco's loaded grammars do not emit a distinct constructor-call token",
      },
      {
        path: "CONSTRUCTOR_CALL_ATTRIBUTES.FONT_TYPE",
        reason: "unsupported: Monaco's loaded grammars do not emit a distinct constructor-call token",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CPP.FIELD")?.deferredPaths).toEqual([
      {
        path: "CPP.FIELD.FOREGROUND",
        reason: "unsupported: Monaco's C++ Monarch grammar emits fields as generic identifiers, not a distinct field token",
      },
      {
        path: "CPP.FIELD.FONT_TYPE",
        reason: "unsupported: Monaco's C++ Monarch grammar emits fields as generic identifiers, not a distinct field token",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CPP.UNUSED")?.deferredPaths).toEqual([
      {
        path: "CPP.UNUSED.EFFECT_TYPE",
        reason: "unsupported: Monaco themes do not expose WebStorm effect-type styles for this C++ attribute",
      },
    ]);
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

  test("classifies P32h CSS token surfaces into loaded Monaco CSS scopes or explicit no-surface deferrals", () => {
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
    expect(report.classifiedTopLevelOptions.map((entry) => entry.name)).toEqual(expect.arrayContaining(p32hNames));
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CSS.COMMENT")?.mappedPaths).toEqual([
      { path: "CSS.COMMENT.FOREGROUND", monacoTargets: ["token:comment.css.foreground"] },
      { path: "CSS.COMMENT.FONT_TYPE", monacoTargets: ["token:comment.css.fontStyle"] },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CSS.COLOR")?.mappedPaths).toEqual([
      { path: "CSS.COLOR.FOREGROUND", monacoTargets: ["token:attribute.value.hex.css.foreground"] },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CSS.PROPERTY_NAME")?.mappedPaths).toEqual([
      { path: "CSS.PROPERTY_NAME.FOREGROUND", monacoTargets: ["token:attribute.name.css.foreground"] },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CSS.FUNCTION")?.deferredPaths).toEqual([
      {
        path: "CSS.FUNCTION.FOREGROUND",
        reason: "unsupported: Monaco's CSS grammar emits functions as generic attribute values, colliding with CSS property values",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CSS.IDENT")?.deferredPaths).toEqual([
      {
        path: "CSS.IDENT.FOREGROUND",
        reason: "unsupported: Monaco's CSS grammar emits class/id selectors as generic tag tokens, not distinct identifiers",
      },
    ]);
    expect(report.classifiedTopLevelOptions.find((entry) => entry.name === "CSS.PROPERTY_VALUE")?.deferredPaths).toEqual([
      {
        path: "CSS.PROPERTY_VALUE.FOREGROUND",
        reason: "unsupported: Monaco's CSS grammar emits generic property values with the same token as functions/units",
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
