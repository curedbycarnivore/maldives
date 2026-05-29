import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseKeymap } from "../../src/parsers/keymap-parser";
import { auditKeymapCoverage, writeKeymapCoverageReport } from "../../scripts/keymap-coverage";

const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));

describe("scripts/keymap-coverage", () => {
  test("diffs the SSOT keymap against Maldives action registrations", () => {
    const coverage = auditKeymapCoverage(keymap);

    expect(coverage.wired).toContain("EditorBackSpace");
    expect(coverage.wired).toContain("SelectNextOccurrence");
    expect(coverage.deferred).toContain("ActivateTerminalToolWindow");
    expect(coverage.wired).toContain("AceJumpAction");
    expect(coverage.unwired).toEqual([]);
  });

  test("writes proof/keymap-coverage.json shaped for watchdog telemetry", () => {
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-keymap-coverage-")), "keymap-coverage.json");

    writeKeymapCoverageReport(keymap, outFile);

    const report = JSON.parse(readFileSync(outFile, "utf-8")) as ReturnType<typeof auditKeymapCoverage>;
    expect(report.wired.length).toBeGreaterThan(40);
    expect(report.unwired).toEqual([]);
    expect(report.deferred).toContain("ActivateTerminalToolWindow");
  });
});
