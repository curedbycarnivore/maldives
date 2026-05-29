#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { KeymapConfig } from "../src/parsers/keymap-parser";
import { parseKeymap } from "../src/parsers/keymap-parser";

export interface KeymapCoverageReport {
  wired: string[];
  unwired: string[];
  deferred: string[];
}

const deferredActionIds = new Set([
  "ActivateDatabaseToolWindow",
  "ActivateDebugToolWindow",
  "ActivateElectroJunToolWindowToolWindow",
  "ActivateRunToolWindow",
  "ActivateStickyNotesToolWindow",
  "ActivateTerminalToolWindow",
  "ActivateVersionControlToolWindow",
  "ActivateYouTrackToolWindow",
  "Activategithub.copilotToolWindowToolWindow",
  "Annotate",
  "CollapseExpandableComponent",
  "CompareClipboardWithSelection",
  "Debug",
  "Diff.NextChange",
  "Diff.NextConflict",
  "Diff.PrevChange",
  "Diff.PreviousConflict",
  "EditSource",
  "Git.Branches",
  "Git.CompareWithBranch",
  "Git.Stash",
  "HideAllWindows",
  "JS.TypeScript.Compile",
  "Javascript.Linters.EsLint.Fix",
  "JumpToNextChange",
  "NextDiff",
  "NextSplitter",
  "NextWindow",
  "PreviousDiff",
  "QuickList.Custom",
  "QuickList.Deployment",
  "RecentProjectListGroup",
  "Rerun",
  "RerunTests",
  "Resume",
  "Run",
  "RunConfiguration",
  "ShowContent",
  "Stop",
  "ToggleContentUiTypeMode",
  "TsLintFileFixAction",
]);

const droppedActionIds = new Set([
  "AceAction",
  "AceJumpAction",
  "AceWordAction",
  "Scala.ShowImplicits",
  "com.anthropic.code.plugin.actions.OpenClaudeInTerminalAction",
  "com.buckstabue.stickynotes.idea.createeditstickynote.CreateStickyNoteAction",
  "com.buckstabue.stickynotes.idea.stickynotelist.ShowStickyNotesAction",
  "com.karateca.jstoolbox.torelated.GoToViewAction",
  "copilot.cycleNextInlays",
  "copilot.cyclePrevInlays",
  "emacsIDEAs.AceJump",
  "emacsIDEAs.AceJumpSelect",
  "emacsIDEAs.AceJumpWord",
  "osmedile.ManipulateStringGroup",
  "osmedile.intellij.stringmanip.DecrementAction",
  "osmedile.intellij.stringmanip.IncrementAction",
  "osmedile.intellij.stringmanip.PopupChoiceAction",
  "osmedile.intellij.stringmanip.SwapCharactersAction",
  "osmedile.intellij.stringmanip.WordsCapitalizeAction",
]);

export function registeredWebStormActionIds(sourceText = readFileSync("src/keybindings/index.ts", "utf-8")): string[] {
  const actionTargetsBlock = sourceText.match(/const actionTargets: Record<string, MonacoTarget> = \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const literalKeys = actionTargetsBlock
    .split("\n")
    .flatMap((line) => {
      const quoted = line.match(/^\s*"([^"]+)":/);
      if (quoted) return [quoted[1]];

      const bare = line.match(/^\s*([A-Za-z_$][\w$]*):/);
      return bare ? [bare[1]] : [];
    });
  const generatedKeys = Array.from(actionTargetsBlock.matchAll(/\.\.\.tabActionTargets\("([^"]+)",\s*(\d+)\)/g))
    .flatMap((match) => Array.from({ length: Number(match[2]) }, (_, index) => `${match[1]}${index + 1}`));

  return [...new Set([...literalKeys, ...generatedKeys])].sort();
}

export function auditKeymapCoverage(keymap: KeymapConfig): KeymapCoverageReport {
  const mapped = new Set(registeredWebStormActionIds());
  const coverageActions = keymap.actions.filter((action) => action.shortcuts.length > 0);
  const wired = coverageActions
    .filter((action) => mapped.has(action.id))
    .map((action) => action.id)
    .sort();
  const deferred = coverageActions
    .filter((action) => !mapped.has(action.id))
    .filter((action) => deferredActionIds.has(action.id) || droppedActionIds.has(action.id))
    .map((action) => action.id)
    .sort();
  const unwired = coverageActions
    .filter((action) => !mapped.has(action.id))
    .filter((action) => !deferredActionIds.has(action.id) && !droppedActionIds.has(action.id))
    .map((action) => action.id)
    .sort();

  return { wired, unwired, deferred };
}

export function writeKeymapCoverageReport(keymap: KeymapConfig, outFile = "proof/keymap-coverage.json"): KeymapCoverageReport {
  const report = auditKeymapCoverage(keymap);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (import.meta.main) {
  const outIndex = process.argv.indexOf("--out");
  const outFile = outIndex === -1 ? "proof/keymap-coverage.json" : process.argv[outIndex + 1];
  const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));
  const report = writeKeymapCoverageReport(keymap, outFile);

  console.log(`keymap coverage: wired=${report.wired.length} deferred=${report.deferred.length} unwired=${report.unwired.length}`);
}
