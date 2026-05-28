import type { editor } from "monaco-editor";
import {
  completeStatementWhenReady,
  expandAstSelectionWhenReady,
  moveElementWhenReady,
  moveStatementWhenReady,
  navigateMethodWhenReady,
} from "../ast-smart-selection";
import { openCodeNavigationOverlay } from "../code-navigation";
import {
  applyActiveTabSwitcherItem,
  moveActiveTabSwitcherItem,
  moveCurrentModelTabRight,
  openGotoFileSwitcher,
  openRecentLocationsOverlay,
  openShowNavBarOverlay,
  openTabSwitcher,
  reopenClosedTab,
  switchToLastModelTab,
  switchToModelTab,
  switchToNextModelTab,
  switchToPreviousModelTab,
} from "../file-switcher";
import type { KeyAction, KeymapConfig } from "../parsers/keymap-parser";

export interface MaldivesAction {
  wsActionId: string;
  monacoBinding: number;
  handler: (editor: editor.IStandaloneCodeEditor) => void;
}

export interface RegisteredMaldivesAction extends MaldivesAction {
  commandId: string;
}

type Monaco = typeof import("monaco-editor");
type EditorSelection = NonNullable<ReturnType<editor.IStandaloneCodeEditor["getSelections"]>>[number];

type MonacoTarget =
  | { type: "action"; id: string }
  | { type: "command"; id: string }
  | {
      type: "custom";
      id:
        | "astSmartSelect"
        | "completeStatement"
        | "chooseLookupAndComplete"
        | "moveElementLeft"
        | "moveElementRight"
        | "methodDown"
        | "methodUp"
        | "gotoSuperMethod"
        | "gotoTest"
        | "methodHierarchy"
        | "moveStatementDown"
        | "moveStatementUp"
        | "removeLastSelection"
        | "humpDeleteLeft"
        | "humpDeleteRight"
        | "toggleCase"
        | "toggleCamelDashCase"
        | "surroundWith"
        | "increaseFontSize"
        | "decreaseFontSize"
        | "resetFontSize"
        | "aceJump"
        | "gotoFile"
        | "tabSwitcher"
        | "recentLocations"
        | "showNavBar"
        | "replaceInPath"
        | "scrollCurrentLineToCenter"
        | "splitLineAtCursor"
        | "switchApply"
        | "switchDown"
        | "switchUp"
        | "switchLeft"
        | "switchRight"
        | "switchNextModelTab"
        | "switchPreviousModelTab"
        | "switchLastModelTab"
        | "moveTabRight"
        | "reopenClosedTab";
    }
  | { type: "custom"; id: "switchModelTab"; tabIndex: number };

function tabActionTargets(prefix: string, count: number): Record<string, MonacoTarget> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [prefix + String(index + 1), { type: "custom", id: "switchModelTab", tabIndex: index + 1 }]),
  );
}

const actionTargets: Record<string, MonacoTarget> = {
  ...tabActionTargets("GoToTab", 8),
  ...tabActionTargets("Go To Tab #", 10),
  ...tabActionTargets("Switch To Tab #", 10),
  NextTab: { type: "custom", id: "switchNextModelTab" },
  "TabSwitcherExtreme.NextTab": { type: "custom", id: "switchNextModelTab" },
  PreviousTab: { type: "custom", id: "switchPreviousModelTab" },
  MoveTabRight: { type: "custom", id: "moveTabRight" },
  ReopenClosedTab: { type: "custom", id: "reopenClosedTab" },
  GoToLastTab: { type: "custom", id: "switchLastModelTab" },
  "Switch To Last Tab": { type: "custom", id: "switchLastModelTab" },
  AceJumpAction: { type: "custom", id: "aceJump" },
  Back: { type: "action", id: "cursorUndo" },
  Forward: { type: "action", id: "cursorRedo" },
  HippieCompletion: { type: "action", id: "editor.action.triggerSuggest" },
  HippieBackwardCompletion: { type: "action", id: "editor.action.triggerSuggest" },
  MoveLineDown: { type: "action", id: "editor.action.moveLinesDownAction" },
  MoveLineUp: { type: "action", id: "editor.action.moveLinesUpAction" },
  MoveElementLeft: { type: "custom", id: "moveElementLeft" },
  MoveElementRight: { type: "custom", id: "moveElementRight" },
  MethodDown: { type: "custom", id: "methodDown" },
  MethodUp: { type: "custom", id: "methodUp" },
  GotoSuperMethod: { type: "custom", id: "gotoSuperMethod" },
  GotoTest: { type: "custom", id: "gotoTest" },
  MethodHierarchy: { type: "custom", id: "methodHierarchy" },
  MoveStatementDown: { type: "custom", id: "moveStatementDown" },
  MoveStatementUp: { type: "custom", id: "moveStatementUp" },
  EditorDeleteLine: { type: "action", id: "editor.action.deleteLines" },
  EditorSelectWord: { type: "custom", id: "astSmartSelect" },
  EditorChooseLookupItemCompleteStatement: { type: "custom", id: "chooseLookupAndComplete" },
  EditorCompleteStatement: { type: "custom", id: "completeStatement" },
  EditorStartNewLine: { type: "action", id: "editor.action.insertLineAfter" },
  EditorStartNewLineBefore: { type: "action", id: "editor.action.insertLineBefore" },
  EditorUnSelectWord: { type: "action", id: "editor.action.smartSelect.shrink" },
  EditorLineStart: { type: "command", id: "cursorHome" },
  EditorLineEnd: { type: "command", id: "cursorEnd" },
  EditorLineStartWithSelection: { type: "command", id: "cursorHomeSelect" },
  EditorLineEndWithSelection: { type: "command", id: "cursorEndSelect" },
  EditorNextWord: { type: "command", id: "cursorWordRight" },
  EditorPreviousWord: { type: "command", id: "cursorWordLeft" },
  EditorNextWordWithSelection: { type: "command", id: "cursorWordRightSelect" },
  EditorPreviousWordWithSelection: { type: "command", id: "cursorWordLeftSelect" },
  EditorDeleteToLineStart: { type: "command", id: "deleteAllLeft" },
  AutoIndentLines: { type: "action", id: "editor.action.reindentlines" },
  EditorDownWithSelection: { type: "command", id: "cursorDownSelect" },
  EditorUpWithSelection: { type: "command", id: "cursorUpSelect" },
  EditorMoveDownAndScroll: { type: "command", id: "scrollLineDown" },
  EditorMoveUpAndScroll: { type: "command", id: "scrollLineUp" },
  EditorPageUp: { type: "command", id: "cursorPageUp" },
  EditorPageDown: { type: "command", id: "cursorPageDown" },
  EditorScrollToCenter: { type: "custom", id: "scrollCurrentLineToCenter" },
  EditorSplitLine: { type: "custom", id: "splitLineAtCursor" },
  EditorCloneCaretAbove: { type: "action", id: "editor.action.insertCursorAbove" },
  EditorCloneCaretBelow: { type: "action", id: "editor.action.insertCursorBelow" },
  CollapseRegion: { type: "action", id: "editor.fold" },
  ExpandRegion: { type: "action", id: "editor.unfold" },
  CollapseRegionRecursively: { type: "action", id: "editor.foldRecursively" },
  ExpandRegionRecursively: { type: "action", id: "editor.unfoldRecursively" },
  CollapseAllRegions: { type: "action", id: "editor.foldAll" },
  ExpandAllRegions: { type: "action", id: "editor.unfoldAll" },
  CollapseAll: { type: "action", id: "editor.foldAll" },
  ExpandAll: { type: "action", id: "editor.unfoldAll" },
  CollapseSelection: { type: "action", id: "editor.fold" },
  CommentByBlockComment: { type: "action", id: "editor.action.blockComment" },
  CommentByLineComment: { type: "action", id: "editor.action.commentLine" },
  GotoNextError: { type: "action", id: "editor.action.marker.next" },
  GotoTypeDeclaration: { type: "action", id: "editor.action.goToTypeDefinition" },
  FileStructurePopup: { type: "action", id: "editor.action.quickOutline" },
  GotoClass: { type: "action", id: "editor.action.quickOutline" },
  GotoFile: { type: "custom", id: "gotoFile" },
  Switcher: { type: "custom", id: "tabSwitcher" },
  RecentLocations: { type: "custom", id: "recentLocations" },
  ShowNavBar: { type: "custom", id: "showNavBar" },
  SwitchApply: { type: "custom", id: "switchApply" },
  SwitchDown: { type: "custom", id: "switchDown" },
  SwitchUp: { type: "custom", id: "switchUp" },
  SwitchLeft: { type: "custom", id: "switchLeft" },
  SwitchRight: { type: "custom", id: "switchRight" },
  SearchEverywhere: { type: "action", id: "editor.action.quickCommand" },
  Replace: { type: "action", id: "editor.action.startFindReplaceAction" },
  ReplaceInPath: { type: "custom", id: "replaceInPath" },
  ShowIntentionActions: { type: "action", id: "editor.action.quickFix" },
  IntroduceActionsGroup: { type: "action", id: "editor.action.refactor" },
  RenameElement: { type: "action", id: "editor.action.rename" },
  ShowUsages: { type: "action", id: "editor.action.referenceSearch.trigger" },
  ReformatCode: { type: "action", id: "editor.action.formatDocument" },
  RearrangeCode: { type: "action", id: "editor.action.organizeImports" },
  EditorDeleteToWordStartInDifferentHumpsMode: { type: "custom", id: "humpDeleteLeft" },
  EditorDeleteToWordEndInDifferentHumpsMode: { type: "custom", id: "humpDeleteRight" },
  EditorToggleCase: { type: "custom", id: "toggleCase" },
  toggleCamelDashCase: { type: "custom", id: "toggleCamelDashCase" },
  SurroundWith: { type: "custom", id: "surroundWith" },
  EditorIncreaseFontSize: { type: "custom", id: "increaseFontSize" },
  EditorDecreaseFontSize: { type: "custom", id: "decreaseFontSize" },
  EditorResetFontSize: { type: "custom", id: "resetFontSize" },
  SelectNextOccurrence: { type: "action", id: "editor.action.addSelectionToNextFindMatch" },
  SelectAllOccurrences: { type: "action", id: "editor.action.selectHighlights" },
  UnselectPreviousOccurrence: { type: "custom", id: "removeLastSelection" },
  EditorNextWordInDifferentHumpsMode: { type: "command", id: "cursorWordPartRight" },
  EditorPreviousWordInDifferentHumpsMode: { type: "command", id: "cursorWordPartLeft" },
  EditorNextWordInDifferentHumpsModeWithSelection: { type: "command", id: "cursorWordPartRightSelect" },
  EditorPreviousWordInDifferentHumpsModeWithSelection: { type: "command", id: "cursorWordPartLeftSelect" },
};

export function buildKeybindings(config: KeymapConfig, monaco: Monaco): MaldivesAction[] {
  return config.actions.flatMap((action) => keybindingsForAction(action, monaco));
}

export function registerKeybindings(
  editor: editor.IStandaloneCodeEditor,
  monaco: Monaco,
  config: KeymapConfig,
): RegisteredMaldivesAction[] {
  const addedSelections: EditorSelection[] = [];
  const actions = buildKeybindings(config, monaco);

  registerCustomEditorActions(editor, actions);

  return actions.flatMap((action) => {
    const commandId = editor.addCommand(action.monacoBinding, () => {
      if (action.wsActionId === "SelectNextOccurrence") {
        trackAddedSelection(editor, addedSelections, () => action.handler(editor));
        return;
      }

      if (action.wsActionId === "UnselectPreviousOccurrence") {
        removeTrackedSelection(editor, addedSelections);
        return;
      }

      action.handler(editor);
    });

    return commandId ? [{ ...action, commandId }] : [];
  });
}

const customEditorActions: Partial<Record<string, { id: string; label: string }>> = {
  EditorToggleCase: { id: "maldives.toggleCase", label: "Toggle Case" },
  toggleCamelDashCase: { id: "maldives.toggleCamelDashCase", label: "Toggle Camel/Dash/Snake Case" },
  EditorIncreaseFontSize: { id: "maldives.increaseFontSize", label: "Increase Font Size" },
  EditorDecreaseFontSize: { id: "maldives.decreaseFontSize", label: "Decrease Font Size" },
  EditorResetFontSize: { id: "maldives.resetFontSize", label: "Reset Font Size" },
};

function registerCustomEditorActions(editor: editor.IStandaloneCodeEditor, actions: MaldivesAction[]): void {
  if (typeof editor.addAction !== "function") {
    return;
  }

  const actionsById = new Map<string, MaldivesAction[]>();

  for (const action of actions) {
    if (customEditorActions[action.wsActionId]) {
      actionsById.set(action.wsActionId, [...(actionsById.get(action.wsActionId) ?? []), action]);
    }
  }

  for (const [wsActionId, registeredActions] of actionsById) {
    const metadata = customEditorActions[wsActionId];
    const handler = registeredActions[0]?.handler;

    if (!metadata || !handler) {
      continue;
    }

    editor.addAction({
      id: metadata.id,
      label: metadata.label,
      keybindings: registeredActions.map((action) => action.monacoBinding),
      run: handler,
    });
  }
}

const shortcutlessActionIds = new Set([
  "Replace",
  "CollapseAll",
  "ExpandAll",
  "CollapseSelection",
  "EditorPageUp",
  "EditorPageDown",
  "EditorScrollToCenter",
  "EditorSplitLine",
  "GotoSuperMethod",
  "GotoTest",
  "MethodHierarchy",
]);

function keybindingsForAction(action: KeyAction, monaco: Monaco): MaldivesAction[] {
  const target = actionTargets[action.id];

  if (!target) {
    return [];
  }

  const shortcuts = shortcutsForAction(action);

  if (shortcuts.length === 0 && shortcutlessActionIds.has(action.id)) {
    return [{ wsActionId: action.id, monacoBinding: 0, handler: handlerForTarget(target) }];
  }

  return shortcuts.flatMap((shortcut) => {
    const monacoBinding = bindingForShortcut(shortcut, monaco);

    return monacoBinding === undefined
      ? []
      : [{ wsActionId: action.id, monacoBinding, handler: handlerForTarget(target) }];
  });
}

function shortcutsForAction(action: KeyAction): string[] {
  if (action.id === "Back") {
    const allowedBackShortcuts = ["home", "meta open_bracket"];

    return action.shortcuts.filter((shortcut) => allowedBackShortcuts.includes(shortcut));
  }

  if (action.id === "Forward") {
    const allowedForwardShortcuts = ["end", "meta close_bracket"];

    return action.shortcuts.filter((shortcut) => allowedForwardShortcuts.includes(shortcut));
  }

  if (action.id === "EditorChooseLookupItemCompleteStatement") {
    return action.shortcuts.filter((shortcut) => shortcut !== "enter");
  }

  return action.shortcuts;
}

function bindingForShortcut(shortcut: string, monaco: Monaco): number | undefined {
  let binding = 0;
  let keyCode: number | undefined;

  for (const token of shortcut.split(" ")) {
    if (token === "meta") {
      binding |= monaco.KeyMod.CtrlCmd;
    } else if (token === "ctrl") {
      binding |= monaco.KeyMod.WinCtrl;
    } else if (token === "shift") {
      binding |= monaco.KeyMod.Shift;
    } else if (token === "alt") {
      binding |= monaco.KeyMod.Alt;
    } else {
      keyCode = keyCodeForToken(token, monaco);
    }
  }

  return keyCode === undefined ? undefined : binding | keyCode;
}

function keyCodeForToken(token: string, monaco: Monaco): number | undefined {
  const keyCodes: Record<string, number> = {
    back_space: monaco.KeyCode.Backspace,
    delete: monaco.KeyCode.Delete,
    enter: monaco.KeyCode.Enter,
    escape: monaco.KeyCode.Escape,
    space: monaco.KeyCode.Space,
    back_quote: monaco.KeyCode.Backquote,
    tab: monaco.KeyCode.Tab,
    page_up: monaco.KeyCode.PageUp,
    page_down: monaco.KeyCode.PageDown,
    home: monaco.KeyCode.Home,
    end: monaco.KeyCode.End,
    left: monaco.KeyCode.LeftArrow,
    up: monaco.KeyCode.UpArrow,
    right: monaco.KeyCode.RightArrow,
    down: monaco.KeyCode.DownArrow,
    minus: monaco.KeyCode.Minus,
    subtract: monaco.KeyCode.NumpadSubtract,
    underscore: monaco.KeyCode.Minus,
    equals: monaco.KeyCode.Equal,
    plus: monaco.KeyCode.Equal,
    add: monaco.KeyCode.NumpadAdd,
    semicolon: monaco.KeyCode.Semicolon,
    colon: monaco.KeyCode.Semicolon,
    period: monaco.KeyCode.Period,
    slash: monaco.KeyCode.Slash,
    divide: monaco.KeyCode.NumpadDivide,
    open_bracket: monaco.KeyCode.BracketLeft,
    close_bracket: monaco.KeyCode.BracketRight,
    braceleft: monaco.KeyCode.BracketLeft,
    braceright: monaco.KeyCode.BracketRight,
    f2: monaco.KeyCode.F2,
    f4: monaco.KeyCode.F4,
    f6: monaco.KeyCode.F6,
    f7: monaco.KeyCode.F7,
    f9: monaco.KeyCode.F9,
    f12: monaco.KeyCode.F12,
    "0": monaco.KeyCode.Digit0,
    "1": monaco.KeyCode.Digit1,
    "2": monaco.KeyCode.Digit2,
    "3": monaco.KeyCode.Digit3,
    "4": monaco.KeyCode.Digit4,
    "5": monaco.KeyCode.Digit5,
    "6": monaco.KeyCode.Digit6,
    "7": monaco.KeyCode.Digit7,
    "8": monaco.KeyCode.Digit8,
    "9": monaco.KeyCode.Digit9,
  };

  if (/^[a-z]$/.test(token)) {
    return monaco.KeyCode[`Key${token.toUpperCase()}` as keyof typeof monaco.KeyCode] as number | undefined;
  }

  return keyCodes[token];
}

function handlerForTarget(target: MonacoTarget): (editor: editor.IStandaloneCodeEditor) => void {
  if (target.type === "action") {
    return (editor) => {
      if (
        target.id === "editor.action.quickOutline" ||
        target.id === "editor.action.quickCommand" ||
        target.id === "editor.action.startFindReplaceAction"
      ) {
        editor.focus();
      }

      void editor.getAction(target.id)?.run();
    };
  }

  if (target.type === "command") {
    return (editor) => {
      editor.trigger("maldives", target.id, null);
    };
  }

  if (target.id === "astSmartSelect") {
    return (editor) => expandAstSelectionWhenReady(editor, () => void editor.getAction("editor.action.smartSelect.expand")?.run());
  }

  if (target.id === "completeStatement") {
    return completeStatementWhenReady;
  }

  if (target.id === "chooseLookupAndComplete") {
    return chooseLookupAndCompleteStatement;
  }

  if (target.id === "moveElementLeft") {
    return (editor) => moveElementWhenReady(editor, "left");
  }

  if (target.id === "moveElementRight") {
    return (editor) => moveElementWhenReady(editor, "right");
  }

  if (target.id === "methodDown") {
    return (editor) => navigateMethodWhenReady(editor, "down");
  }

  if (target.id === "methodUp") {
    return (editor) => navigateMethodWhenReady(editor, "up");
  }

  if (target.id === "gotoSuperMethod" || target.id === "gotoTest" || target.id === "methodHierarchy") {
    return (editor) => openCodeNavigationOverlay(editor, target.id);
  }

  if (target.id === "moveStatementDown") {
    return (editor) => moveStatementWhenReady(editor, "down");
  }

  if (target.id === "moveStatementUp") {
    return (editor) => moveStatementWhenReady(editor, "up");
  }

  if (target.id === "humpDeleteLeft") {
    return (editor) => deleteToWordPart(editor, "left");
  }

  if (target.id === "humpDeleteRight") {
    return (editor) => deleteToWordPart(editor, "right");
  }

  if (target.id === "toggleCase") {
    return (editor) => replaceSelections(editor, toggleCaseText);
  }

  if (target.id === "toggleCamelDashCase") {
    return (editor) => replaceSelections(editor, toggleCamelDashCaseText);
  }

  if (target.id === "surroundWith") {
    return openSurroundWithOverlay;
  }

  if (target.id === "increaseFontSize") {
    return (editor) => updateFontSize(editor, 1);
  }

  if (target.id === "decreaseFontSize") {
    return (editor) => updateFontSize(editor, -1);
  }

  if (target.id === "resetFontSize") {
    return (editor) => setFontSize(editor, DEFAULT_FONT_SIZE);
  }

  if (target.id === "aceJump") {
    return (editor) => {
      editor.focus();
      void editor.getAction("editor.action.gotoLine")?.run();
    };
  }

  if (target.id === "gotoFile") {
    return openGotoFileSwitcher;
  }

  if (target.id === "tabSwitcher") {
    return openTabSwitcher;
  }

  if (target.id === "recentLocations") {
    return openRecentLocationsOverlay;
  }

  if (target.id === "showNavBar") {
    return openShowNavBarOverlay;
  }

  if (target.id === "replaceInPath") {
    return openReplaceInPathPlaceholder;
  }

  if (target.id === "scrollCurrentLineToCenter") {
    return scrollCurrentLineToCenter;
  }

  if (target.id === "splitLineAtCursor") {
    return splitLineAtCursor;
  }

  if (target.id === "switchApply") {
    return () => applyActiveTabSwitcherItem();
  }

  if (target.id === "switchDown" || target.id === "switchRight") {
    return () => moveActiveTabSwitcherItem("next");
  }

  if (target.id === "switchUp" || target.id === "switchLeft") {
    return () => moveActiveTabSwitcherItem("previous");
  }

  if (target.id === "switchModelTab") {
    return (editor) => void switchToModelTab(editor, target.tabIndex);
  }

  if (target.id === "switchNextModelTab") {
    return (editor) => void switchToNextModelTab(editor);
  }

  if (target.id === "switchPreviousModelTab") {
    return (editor) => void switchToPreviousModelTab(editor);
  }

  if (target.id === "switchLastModelTab") {
    return (editor) => void switchToLastModelTab(editor);
  }

  if (target.id === "moveTabRight") {
    return (editor) => void moveCurrentModelTabRight(editor);
  }

  if (target.id === "reopenClosedTab") {
    return (editor) => void reopenClosedTab(editor);
  }

  return removeLastSelection;
}

const CHOOSE_LOOKUP_COMPLETE_SETTLE_ATTEMPTS = 20;
const CHOOSE_LOOKUP_COMPLETE_SETTLE_DELAY_MS = 10;

function chooseLookupAndCompleteStatement(editor: editor.IStandaloneCodeEditor): void {
  const model = typeof editor.getModel === "function" ? editor.getModel() : undefined;
  const beforeValue = model?.getValue();

  editor.trigger("keyboard", "acceptSelectedSuggestion", {});
  completeStatementAfterSuggestionSettles(editor, beforeValue, CHOOSE_LOOKUP_COMPLETE_SETTLE_ATTEMPTS);
}

function completeStatementAfterSuggestionSettles(
  editor: editor.IStandaloneCodeEditor,
  beforeValue: string | undefined,
  attemptsLeft: number,
): void {
  globalThis.setTimeout(() => {
    const model = typeof editor.getModel === "function" ? editor.getModel() : undefined;
    const contentChanged = beforeValue === undefined || model?.getValue() !== beforeValue;
    const widgetSettled = !editorHasWidgetFocus(editor);

    if ((!contentChanged || !widgetSettled) && attemptsLeft > 0) {
      completeStatementAfterSuggestionSettles(editor, beforeValue, attemptsLeft - 1);
      return;
    }

    editor.focus?.();
    completeStatementWhenReady(editor, undefined, { ignoreWidgetFocus: true });
  }, CHOOSE_LOOKUP_COMPLETE_SETTLE_DELAY_MS);
}

function editorHasWidgetFocus(editor: editor.IStandaloneCodeEditor): boolean {
  return typeof editor.hasWidgetFocus === "function" && editor.hasWidgetFocus();
}

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const fontSizesByEditor = new WeakMap<editor.IStandaloneCodeEditor, number>();

export function toggleCaseText(value: string): string {
  return value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase();
}

export function toggleCamelDashCaseText(value: string): string {
  if (value.includes("-")) {
    return value.replaceAll("-", "_");
  }

  if (value.includes("_")) {
    return value.replace(/_([a-zA-Z0-9])/g, (_, character: string) => character.toUpperCase());
  }

  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export type SurroundWithKind = "braces" | "parentheses" | "if";

export function surroundSelectionText(value: string, kind: SurroundWithKind): string {
  if (kind === "parentheses") {
    return `(${value})`;
  }

  if (kind === "if") {
    return `if (true) {\n${indentSurroundedText(value)}\n}`;
  }

  return `{\n${indentSurroundedText(value)}\n}`;
}

function indentSurroundedText(value: string): string {
  return value
    .split("\n")
    .map((line) => (line.length === 0 ? line : `  ${line}`))
    .join("\n");
}

export function scrollCurrentLineToCenter(editor: editor.IStandaloneCodeEditor): void {
  const position = editor.getPosition();

  if (!position) {
    return;
  }

  editor.revealLineInCenter(position.lineNumber);
  editor.focus();
}

export function splitLineAtCursor(editor: editor.IStandaloneCodeEditor): void {
  const position = editor.getPosition();

  if (!position) {
    return;
  }

  editor.executeEdits("maldives", [
    {
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      text: "\n",
    },
  ]);
  editor.setPosition(position);
  editor.focus();
}

export function deleteToWordPart(editor: editor.IStandaloneCodeEditor, direction: "left" | "right"): void {
  const start = editor.getPosition();

  if (!start) {
    return;
  }

  editor.trigger("maldives", direction === "left" ? "cursorWordPartLeft" : "cursorWordPartRight", null);

  const end = editor.getPosition();

  if (!end || (end.lineNumber === start.lineNumber && end.column === start.column)) {
    return;
  }

  const range =
    direction === "left"
      ? {
          startLineNumber: end.lineNumber,
          startColumn: end.column,
          endLineNumber: start.lineNumber,
          endColumn: start.column,
        }
      : {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        };

  editor.executeEdits("maldives", [{ range, text: "" }]);
}

function replaceSelections(editor: editor.IStandaloneCodeEditor, transform: (value: string) => string): void {
  const model = editor.getModel();
  const selections = editor.getSelections()?.filter((selection) => !selection.isEmpty());

  if (!model || !selections?.length) {
    return;
  }

  editor.executeEdits(
    "maldives",
    selections.map((selection) => ({ range: selection, text: transform(model.getValueInRange(selection)) })),
  );
}

function openReplaceInPathPlaceholder(editor: editor.IStandaloneCodeEditor): void {
  document.querySelector(".maldives-replace-in-path")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "maldives-replace-in-path";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Replace in Path");
  overlay.style.cssText = [
    "position:fixed",
    "top:72px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:10000",
    "width:min(420px, calc(100vw - 32px))",
    "background:#1e1e1e",
    "color:#d4d4d4",
    "border:1px solid #454545",
    "box-shadow:0 12px 32px rgba(0,0,0,.45)",
    "font:13px system-ui, sans-serif",
    "padding:12px",
  ].join(";");

  const heading = document.createElement("div");
  heading.textContent = "Replace in Path";
  heading.style.cssText = "color:#fff;font-weight:600;margin-bottom:6px";

  const message = document.createElement("div");
  message.textContent = "Multi-file replace is not available in standalone Monaco yet. Use Replace for the current editor.";
  message.style.cssText = "line-height:1.4";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "margin-top:12px;padding:6px 10px;background:#2d2d2d;color:inherit;border:1px solid #555;cursor:pointer";
  close.addEventListener("click", () => {
    overlay.remove();
    editor.focus();
  });

  overlay.append(heading, message, close);
  document.body.append(overlay);
  close.focus();
}

function openSurroundWithOverlay(editor: editor.IStandaloneCodeEditor): void {
  const model = editor.getModel();
  const selections = editor.getSelections()?.filter((selection) => !selection.isEmpty());

  if (!model || !selections?.length) {
    editor.focus();
    return;
  }

  document.querySelector(".maldives-surround-with")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "maldives-surround-with";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Surround With");
  overlay.style.cssText = [
    "position:fixed",
    "top:72px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:10000",
    "width:min(360px, calc(100vw - 32px))",
    "background:#1e1e1e",
    "color:#d4d4d4",
    "border:1px solid #454545",
    "box-shadow:0 12px 32px rgba(0,0,0,.45)",
    "font:13px system-ui, sans-serif",
  ].join(";");

  const heading = document.createElement("div");
  heading.textContent = "Surround With";
  heading.style.cssText = "padding:10px 12px;border-bottom:1px solid #333;color:#fff;font-weight:600";
  overlay.append(heading);

  const options: { label: string; kind: SurroundWithKind }[] = [
    { label: "Braces block", kind: "braces" },
    { label: "Parentheses", kind: "parentheses" },
    { label: "if (...) { ... }", kind: "if" },
  ];

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "maldives-surround-with-item";
    button.textContent = option.label;
    button.style.cssText = [
      "display:block",
      "width:100%",
      "padding:10px 12px",
      "border:0",
      "background:transparent",
      "color:inherit",
      "text-align:left",
      "cursor:pointer",
    ].join(";");
    button.addEventListener("click", () => {
      editor.executeEdits(
        "maldives",
        selections.map((selection) => ({ range: selection, text: surroundSelectionText(model.getValueInRange(selection), option.kind) })),
      );
      overlay.remove();
      editor.focus();
    });
    overlay.append(button);
  }

  document.body.append(overlay);
  (overlay.querySelector("button") as HTMLButtonElement | null)?.focus();
}

function updateFontSize(editor: editor.IStandaloneCodeEditor, delta: number): void {
  setFontSize(editor, (fontSizesByEditor.get(editor) ?? DEFAULT_FONT_SIZE) + delta);
}

function setFontSize(editor: editor.IStandaloneCodeEditor, fontSize: number): void {
  const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize));

  fontSizesByEditor.set(editor, clamped);
  editor.updateOptions({ fontSize: clamped });
}

function trackAddedSelection(
  editor: Pick<editor.IStandaloneCodeEditor, "getSelections">,
  addedSelections: EditorSelection[],
  run: () => void,
): void {
  const before = editor.getSelections() ?? [];

  run();

  const after = editor.getSelections() ?? [];
  const added = after.find((selection) => !before.some((existing) => selection.equalsSelection(existing)));

  if (added) {
    addedSelections.push(added);
  }
}

function removeTrackedSelection(
  editor: Pick<editor.IStandaloneCodeEditor, "getSelections" | "setSelections">,
  addedSelections: EditorSelection[],
): void {
  if (addedSelections.length === 0) {
    return;
  }

  removeSelection(editor, addedSelections.pop());
}

function removeSelection(
  editor: Pick<editor.IStandaloneCodeEditor, "getSelections" | "setSelections">,
  selectionToRemove: EditorSelection | undefined,
): void {
  const selections = editor.getSelections();

  if (!selections || selections.length <= 1 || !selectionToRemove) {
    return;
  }

  const remainingSelections = selections.filter((selection) => !selection.equalsSelection(selectionToRemove));

  if (remainingSelections.length !== selections.length) {
    editor.setSelections(remainingSelections);
  }
}

export function removeLastSelection(editor: Pick<editor.IStandaloneCodeEditor, "getSelections" | "setSelections">): void {
  const selections = editor.getSelections();

  if (selections && selections.length > 1) {
    editor.setSelections(selections.slice(0, -1));
  }
}
