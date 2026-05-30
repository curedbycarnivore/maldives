#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { KeymapConfig } from "../src/parsers/keymap-parser";
import { parseKeymap } from "../src/parsers/keymap-parser";

export interface KeymapCoverageReport {
  wired: string[];
  unwired: string[];
  deferred: string[];
  dropped: string[];
  deferredReasons: Record<string, string>;
  dropReasons: Record<string, string>;
  totals: {
    ssot: number;
    wired: number;
    deferred: number;
    dropped: number;
    unwired: number;
    accounted: number;
    unaccounted: number;
  };
}

const deferredActionIds = new Set([
  "ActivateDatabaseToolWindow",
  "ActivateDebugToolWindow",
  "ActivateElectroJunToolWindowToolWindow",
  "ActivateRunToolWindow",
  "ActivateTerminalToolWindow",
  "ActivateVersionControlToolWindow",
  "ActivateYouTrackToolWindow",
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
  "ActivateFavoritesToolWindow",
  "ActivateFindToolWindow",
  "ActivateMessagesToolWindow",
  "ActivateServicesToolWindow",
  "ActivateTODOToolWindow",
  "AddToFavoritesPopup",
  "ChangesView.AddUnversioned",
  "ChangesView.ShelveSilently",
  "CheckinProject",
  "ChooseDebugConfiguration",
  "CodeInspection.OnEditor",
  "DebugClass",
  "Diff.ShowSettingsPopup",
  "ExternalSystem.ProjectRefreshAction",
  "FileChooser.TogglePathShowing",
  "Generate",
  "HideActiveWindow",
  "Images.ShowThumbnails",
  "ImplementMethods",
  "InsertLiveTemplate",
  "IntroduceConstant",
  "IntroduceField",
  "IntroduceVariable",
  "MaintenanceAction",
  "OverrideMethods",
  "RecentChangedFiles",
  "RecentChanges",
  "Refactorings.QuickListPopupAction",
  "Refresh",
  "RunClass",
  "SavaAs",
  "ShowReformatFileDialog",
  "Unwrap",
  "UsageView.Include",
  "Vcs.UpdateProject",
  "tasks.close",
  "tasks.goto",
  "tasks.open.in.browser",
  "tasks.switch",
]);

const droppedActionIds = new Set([
  "AceAction",
  "AceJumpAction",
  "AceLineAction",
  "AceWordAction",
  "ActivateStickyNotesToolWindow",
  "Activategithub.copilotToolWindowToolWindow",
  "DBNavigator.Actions.Calendar.CalendarNextMonth",
  "DBNavigator.Actions.Calendar.CalendarPreviousMonth",
  "Scala.ShowImplicits",
  "com.anthropic.code.plugin.actions.OpenClaudeInTerminalAction",
  "com.buckstabue.stickynotes.idea.createeditstickynote.CreateStickyNoteAction",
  "com.buckstabue.stickynotes.idea.stickynotelist.ShowStickyNotesAction",
  "com.karateca.jstoolbox.torelated.GoToViewAction",
  "copilot.applyInlaysNextWord",
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
  "org.intellij.plugins.markdown.ui.actions.styling.ToggleBoldAction",
  "org.intellij.plugins.markdown.ui.actions.styling.ToggleItalicAction",
]);

function deferredReasonFor(actionId: string): string {
  if (actionId.startsWith("Activate") || actionId.includes("ToolWindow") || actionId.includes("Window")) {
    return "deferred — IDE-shell tool-window subsystem not built yet";
  }
  if (actionId.startsWith("Git.") || actionId.startsWith("ChangesView.") || actionId === "CheckinProject" || actionId.startsWith("Vcs.") || actionId.includes("Diff") || actionId.includes("Change") || actionId === "Annotate") {
    return "deferred — VCS/diff subsystem not built yet";
  }
  if (actionId.startsWith("Debug") || actionId.startsWith("Run") || actionId === "ChooseDebugConfiguration" || actionId === "Resume" || actionId === "Stop" || actionId === "Rerun" || actionId === "RerunTests") {
    return "deferred — run/debug subsystem not built yet";
  }
  if (actionId.startsWith("tasks.")) {
    return "deferred — IDE task-runner subsystem not built yet";
  }
  if (actionId.includes("Favorites")) {
    return "deferred — favorites subsystem not built yet";
  }
  if (actionId === "ActivateTerminalToolWindow") {
    return "deferred — integrated terminal subsystem not built yet";
  }
  return "deferred — WebStorm IDE-shell action needs a later maldives subsystem";
}

function dropReasonFor(actionId: string): string {
  if (actionId.includes("Ace")) {
    return "dropped: no maldives equivalent — third-party AceJump character-overlay plugin";
  }
  if (actionId.includes("copilot")) {
    return "dropped: no maldives equivalent — third-party plugin (Copilot)";
  }
  if (actionId.includes("DBNavigator")) {
    return "dropped: no maldives equivalent — third-party plugin (DBNavigator)";
  }
  if (actionId.includes("stickynote") || actionId.includes("StickyNotes")) {
    return "dropped: no maldives equivalent — third-party plugin (sticky notes)";
  }
  if (actionId.startsWith("com.") || actionId.startsWith("org.intellij.plugins.") || actionId.startsWith("osmedile.") || actionId === "Scala.ShowImplicits") {
    return "dropped: no maldives equivalent — third-party plugin";
  }
  return "dropped: no maldives equivalent — out-of-scope WebStorm plugin action";
}

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
  const wired: string[] = [];
  const deferred: string[] = [];
  const dropped: string[] = [];
  const unwired: string[] = [];

  for (const action of keymap.actions) {
    if (droppedActionIds.has(action.id)) {
      dropped.push(action.id);
    } else if (mapped.has(action.id)) {
      wired.push(action.id);
    } else if (deferredActionIds.has(action.id)) {
      deferred.push(action.id);
    } else {
      unwired.push(action.id);
    }
  }

  wired.sort();
  deferred.sort();
  dropped.sort();
  unwired.sort();

  const deferredReasons = Object.fromEntries(deferred.map((actionId) => [actionId, deferredReasonFor(actionId)]));
  const dropReasons = Object.fromEntries(dropped.map((actionId) => [actionId, dropReasonFor(actionId)]));
  const accounted = wired.length + deferred.length + dropped.length;

  return {
    wired,
    unwired,
    deferred,
    dropped,
    deferredReasons,
    dropReasons,
    totals: {
      ssot: keymap.actions.length,
      wired: wired.length,
      deferred: deferred.length,
      dropped: dropped.length,
      unwired: unwired.length,
      accounted,
      unaccounted: unwired.length,
    },
  };
}

export function writeKeymapCoverageReport(keymap: KeymapConfig, outFile = "proof/keymap-coverage.json"): KeymapCoverageReport {
  const report = auditKeymapCoverage(keymap);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function writeUnwiredActionSpecs(
  keymap: KeymapConfig,
  report = auditKeymapCoverage(keymap),
  outFile = "proof/keymap-unwired-action-specs.md",
): void {
  const shortcutByAction = new Map(
    keymap.actions.map((action) => [action.id, action.shortcuts.join(", ") || "no shortcut"]),
  );
  const lines = [
    "# Keymap Unwired Action Specs",
    "",
    "Source: `ssot/keymaps/leet hax.xml` vs `src/keybindings/index.ts`.",
    `Coverage summary: wired=${report.wired.length} deferred=${report.deferred.length} dropped=${report.dropped.length} unwired=${report.unwired.length} accounted=${report.totals.accounted}/${report.totals.ssot}.`,
    "",
  ];

  if (report.unwired.length === 0) {
    lines.push("No unwired SSOT actions remain.", "");
  } else {
    report.unwired.forEach((actionId, index) => {
      if (index % 25 === 0) lines.push(`## Batch ${Math.floor(index / 25) + 1}`, "");
      lines.push(
        `- [ ] ${actionId} (${shortcutByAction.get(actionId) ?? "shortcut unknown"}) — preserve the WebStorm action semantics with a verified Monaco equivalent or record a defer/drop reason before implementation.`,
      );
    });
    lines.push("");
  }

  if (report.dropped.length > 0) {
    lines.push("## Dropped Actions", "");
    report.dropped.forEach((actionId) => {
      lines.push(`- ${actionId} — ${report.dropReasons[actionId]}`);
    });
    lines.push("");
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${lines.join("\n")}\n`);
}

if (import.meta.main) {
  const outIndex = process.argv.indexOf("--out");
  const specsOutIndex = process.argv.indexOf("--unwired-specs-out");
  const outFile = outIndex === -1 ? "proof/keymap-coverage.json" : process.argv[outIndex + 1];
  const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));
  const report = writeKeymapCoverageReport(keymap, outFile);

  if (specsOutIndex !== -1) {
    writeUnwiredActionSpecs(keymap, report, process.argv[specsOutIndex + 1] ?? "proof/keymap-unwired-action-specs.md");
  }

  console.log(
    `keymap coverage: wired=${report.wired.length} deferred=${report.deferred.length} dropped=${report.dropped.length} unwired=${report.unwired.length} accounted=${report.totals.accounted}/${report.totals.ssot}`,
  );
}
