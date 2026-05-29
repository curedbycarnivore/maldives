import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseKeymap } from "../../src/parsers/keymap-parser";
import { auditKeymapCoverage, writeUnwiredActionSpecs } from "../../scripts/keymap-coverage";

const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));

describe("P15b unwired keymap action specs", () => {
  test("writes the real SSOT unwired-action batch plan, or an explicit empty result when parity is closed", () => {
    const coverage = auditKeymapCoverage(keymap);
    const outFile = join(mkdtempSync(join(tmpdir(), "maldives-keymap-unwired-specs-")), "keymap-unwired-action-specs.md");

    writeUnwiredActionSpecs(keymap, coverage, outFile);

    const markdown = readFileSync(outFile, "utf-8");
    expect(coverage.unwired).toEqual([]);
    expect(markdown).toContain("# Keymap Unwired Action Specs");
    expect(markdown).toContain("No unwired shortcut-bearing SSOT actions remain.");
    expect(markdown).toContain(`wired=${coverage.wired.length}`);
    expect(markdown).toContain(`deferred=${coverage.deferred.length}`);
  });
});
