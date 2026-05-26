import type { editor } from "monaco-editor";
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
        | "removeLastSelection"
        | "humpDeleteLeft"
        | "humpDeleteRight"
        | "toggleCase"
        | "toggleCamelDashCase"
        | "increaseFontSize"
        | "decreaseFontSize"
        | "resetFontSize";
    };

const actionTargets: Record<string, MonacoTarget> = {
  MoveLineDown: { type: "action", id: "editor.action.moveLinesDownAction" },
  MoveLineUp: { type: "action", id: "editor.action.moveLinesUpAction" },
  MoveStatementDown: { type: "action", id: "editor.action.moveCaretToLogicalLineDown" },
  MoveStatementUp: { type: "action", id: "editor.action.moveCaretToLogicalLineUp" },
  EditorDeleteLine: { type: "action", id: "editor.action.deleteLines" },
  EditorSelectWord: { type: "action", id: "editor.action.smartSelect.expand" },
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
  EditorCloneCaretAbove: { type: "action", id: "editor.action.insertCursorAbove" },
  EditorCloneCaretBelow: { type: "action", id: "editor.action.insertCursorBelow" },
  CollapseRegion: { type: "action", id: "editor.fold" },
  ExpandRegion: { type: "action", id: "editor.unfold" },
  CollapseRegionRecursively: { type: "action", id: "editor.foldRecursively" },
  ExpandRegionRecursively: { type: "action", id: "editor.unfoldRecursively" },
  CollapseAllRegions: { type: "action", id: "editor.foldAll" },
  ExpandAllRegions: { type: "action", id: "editor.unfoldAll" },
  CommentByBlockComment: { type: "action", id: "editor.action.blockComment" },
  CommentByLineComment: { type: "action", id: "editor.action.commentLine" },
  GotoNextError: { type: "action", id: "editor.action.marker.next" },
  GotoTypeDeclaration: { type: "action", id: "editor.action.goToTypeDefinition" },
  ShowIntentionActions: { type: "action", id: "editor.action.quickFix" },
  RenameElement: { type: "action", id: "editor.action.rename" },
  ShowUsages: { type: "action", id: "editor.action.referenceSearch.trigger" },
  ReformatCode: { type: "action", id: "editor.action.formatDocument" },
  EditorDeleteToWordStartInDifferentHumpsMode: { type: "custom", id: "humpDeleteLeft" },
  EditorDeleteToWordEndInDifferentHumpsMode: { type: "custom", id: "humpDeleteRight" },
  EditorToggleCase: { type: "custom", id: "toggleCase" },
  toggleCamelDashCase: { type: "custom", id: "toggleCamelDashCase" },
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

function keybindingsForAction(action: KeyAction, monaco: Monaco): MaldivesAction[] {
  const target = actionTargets[action.id];

  if (!target) {
    return [];
  }

  return action.shortcuts.flatMap((shortcut) => {
    const monacoBinding = bindingForShortcut(shortcut, monaco);

    return monacoBinding === undefined
      ? []
      : [{ wsActionId: action.id, monacoBinding, handler: handlerForTarget(target) }];
  });
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
    slash: monaco.KeyCode.Slash,
    divide: monaco.KeyCode.NumpadDivide,
    open_bracket: monaco.KeyCode.BracketLeft,
    f2: monaco.KeyCode.F2,
    f6: monaco.KeyCode.F6,
    f7: monaco.KeyCode.F7,
    "0": monaco.KeyCode.Digit0,
    "1": monaco.KeyCode.Digit1,
    "2": monaco.KeyCode.Digit2,
  };

  if (/^[a-z]$/.test(token)) {
    return monaco.KeyCode[`Key${token.toUpperCase()}` as keyof typeof monaco.KeyCode] as number | undefined;
  }

  return keyCodes[token];
}

function handlerForTarget(target: MonacoTarget): (editor: editor.IStandaloneCodeEditor) => void {
  if (target.type === "action") {
    return (editor) => {
      void editor.getAction(target.id)?.run();
    };
  }

  if (target.type === "command") {
    return (editor) => {
      editor.trigger("maldives", target.id, null);
    };
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

  if (target.id === "increaseFontSize") {
    return (editor) => updateFontSize(editor, 1);
  }

  if (target.id === "decreaseFontSize") {
    return (editor) => updateFontSize(editor, -1);
  }

  if (target.id === "resetFontSize") {
    return (editor) => setFontSize(editor, DEFAULT_FONT_SIZE);
  }

  return removeLastSelection;
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
