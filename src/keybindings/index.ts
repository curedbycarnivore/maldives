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

type MonacoTarget =
  | { type: "action"; id: string }
  | { type: "command"; id: string }
  | { type: "custom"; id: "removeLastSelection" };

const actionTargets: Record<string, MonacoTarget> = {
  MoveLineDown: { type: "action", id: "editor.action.moveLinesDownAction" },
  MoveLineUp: { type: "action", id: "editor.action.moveLinesUpAction" },
  MoveStatementDown: { type: "action", id: "editor.action.moveCaretToLogicalLineDown" },
  MoveStatementUp: { type: "action", id: "editor.action.moveCaretToLogicalLineUp" },
  EditorDeleteLine: { type: "action", id: "editor.action.deleteLines" },
  EditorSelectWord: { type: "action", id: "editor.action.smartSelect.expand" },
  EditorUnSelectWord: { type: "action", id: "editor.action.smartSelect.shrink" },
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
  EditorDeleteToWordStartInDifferentHumpsMode: { type: "command", id: "deleteWordPartLeft" },
  EditorDeleteToWordEndInDifferentHumpsMode: { type: "command", id: "deleteWordPartRight" },
  EditorToggleCase: { type: "action", id: "editor.action.transformToUppercase" },
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
  return buildKeybindings(config, monaco).flatMap((action) => {
    const commandId = editor.addCommand(action.monacoBinding, () => action.handler(editor));

    return commandId ? [{ ...action, commandId }] : [];
  });
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

  return removeLastSelection;
}

export function removeLastSelection(editor: Pick<editor.IStandaloneCodeEditor, "getSelections" | "setSelections">): void {
  const selections = editor.getSelections();

  if (selections && selections.length > 1) {
    editor.setSelections(selections.slice(0, -1));
  }
}
