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

  test("writes proof/theme-coverage.json shaped for watchdog telemetry", () => {
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-theme-coverage-")), "theme-coverage.json");

    writeThemeCoverageReport(iclsXml, outFile);

    const report = JSON.parse(readFileSync(outFile, "utf-8")) as ReturnType<typeof auditThemeCoverageMappings>;
    expect(report.totalOptions).toBeGreaterThan(1_000);
    expect(report.mapped.length).toBeGreaterThan(30);
    expect(report.top50Unmapped).toHaveLength(50);
  });
});
