import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type * as Monaco from "monaco-editor";
import { buildKeybindings } from "../../src/keybindings";
import { parseKeymap } from "../../src/parsers/keymap-parser";

const keyCodeNames = [
  "Backspace",
  "Delete",
  "Enter",
  "Escape",
  "Space",
  "Backquote",
  "Tab",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "LeftArrow",
  "UpArrow",
  "RightArrow",
  "DownArrow",
  "Minus",
  "NumpadSubtract",
  "Equal",
  "NumpadAdd",
  "Semicolon",
  "Period",
  "Slash",
  "NumpadDivide",
  "BracketLeft",
  "BracketRight",
  "F2",
  "F4",
  "F6",
  "F7",
  "F9",
  "F12",
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `Key${letter}`),
];

const monaco = {
  KeyMod: {
    CtrlCmd: 2048,
    Shift: 1024,
    Alt: 512,
    WinCtrl: 256,
  },
  KeyCode: Object.fromEntries(keyCodeNames.map((name, index) => [name, index + 1])),
} as unknown as typeof Monaco;

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

describe("leet hax keymap parity coverage", () => {
  const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));
  const shortcutActions = keymap.actions.filter((action) => action.shortcuts.length > 0);
  const boundActionIds = new Set(buildKeybindings(keymap, monaco).map((action) => action.wsActionId));

  test("wires every in-scope SSOT action with a Maldives/Monaco binding", () => {
    const missing = shortcutActions
      .filter((action) => !deferredActionIds.has(action.id))
      .filter((action) => !droppedActionIds.has(action.id))
      .filter((action) => !boundActionIds.has(action.id))
      .map((action) => `${action.id}: ${action.shortcuts.join(", ")}`);

    expect(missing).toEqual([]);
  });

  test("keeps the remaining keymap gaps explicitly classified", () => {
    const classified = new Set([...deferredActionIds, ...droppedActionIds]);
    const unknownClassifications = shortcutActions
      .filter((action) => !boundActionIds.has(action.id))
      .filter((action) => !classified.has(action.id))
      .map((action) => action.id);

    expect(unknownClassifications).toEqual([]);
  });
});
