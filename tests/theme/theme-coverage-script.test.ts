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
        expect.objectContaining({ name: "CONSOLE_BACKGROUND_KEY", occurrences: 1 }),
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
    expect(p15iNames).toEqual([
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
    ]);
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

  test("writes proof/theme-coverage.json shaped for watchdog telemetry", () => {
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-theme-coverage-")), "theme-coverage.json");

    writeThemeCoverageReport(iclsXml, outFile);

    const report = JSON.parse(readFileSync(outFile, "utf-8")) as ReturnType<typeof auditThemeCoverageMappings>;
    expect(report.totalOptions).toBeGreaterThan(1_000);
    expect(report.mapped.length).toBeGreaterThan(30);
    expect(report.top50Unmapped).toHaveLength(50);
  });
});
