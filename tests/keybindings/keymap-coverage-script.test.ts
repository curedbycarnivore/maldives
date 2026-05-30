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
    expect(coverage.wired).toContain("EditorPageDown");
    expect(coverage.wired).toContain("ActivateTerminalToolWindow");
    expect(coverage.wired).toContain("ActivateVersionControlToolWindow");
    expect(coverage.wired).toContain("Annotate");
    expect(coverage.wired).toContain("ChangesView.ShelveSilently");
    expect(coverage.wired).toContain("CheckinProject");
    expect(coverage.wired).toContain("Git.Branches");
    expect(coverage.wired).toContain("Vcs.UpdateProject");
    expect(coverage.wired).toContain("Debug");
    expect(coverage.wired).toContain("DebugClass");
    expect(coverage.wired).toContain("Run");
    expect(coverage.wired).toContain("RunClass");
    expect(coverage.wired).toContain("Stop");
    expect(coverage.wired).toContain("tasks.switch");
    expect(coverage.wired).toContain("tasks.open.in.browser");
    expect(coverage.deferred).not.toContain("ActivateTerminalToolWindow");
    expect(coverage.deferred).not.toContain("Annotate");
    expect(coverage.deferred).not.toContain("Run");
    expect(coverage.deferred).not.toContain("tasks.switch");
    expect(coverage.dropped).toContain("AceJumpAction");
    expect(coverage.dropped).toContain("DBNavigator.Actions.Calendar.CalendarNextMonth");
    expect(coverage.dropReasons["AceJumpAction"]).toContain("no maldives equivalent");
    expect(coverage.dropReasons["copilot.applyInlaysNextWord"]).toContain("third-party plugin");
    expect(coverage.unwired).toEqual([]);
  });

  test("accounts for every SSOT action exactly once across honest buckets", () => {
    const coverage = auditKeymapCoverage(keymap);
    const ssotActionIds = keymap.actions.map((action) => action.id);
    const buckets = [coverage.wired, coverage.deferred, coverage.dropped, coverage.unwired];
    const accounted = buckets.flat();

    expect(new Set(ssotActionIds).size).toBe(230);
    expect(accounted).toHaveLength(230);
    expect(new Set(accounted).size).toBe(230);
    expect([...accounted].sort()).toEqual([...ssotActionIds].sort());
    expect(coverage.unwired).toEqual([]);
    expect(coverage.totals).toMatchObject({ ssot: 230, accounted: 230, unaccounted: 0 });
    expect(coverage.totals.wired + coverage.totals.deferred + coverage.totals.dropped).toBe(230);
  });

  test("writes proof/keymap-coverage.json shaped for watchdog telemetry", () => {
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-keymap-coverage-")), "keymap-coverage.json");

    writeKeymapCoverageReport(keymap, outFile);

    const report = JSON.parse(readFileSync(outFile, "utf-8")) as ReturnType<typeof auditKeymapCoverage>;
    expect(report.wired.length).toBeGreaterThan(40);
    expect(report.unwired).toEqual([]);
    expect(report.wired).toContain("ActivateTerminalToolWindow");
    expect(report.wired).toContain("tasks.goto");
  });
});
