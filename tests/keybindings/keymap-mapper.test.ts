import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import type * as Monaco from "monaco-editor";
import { buildKeybindings, registerKeybindings, removeLastSelection } from "../../src/keybindings";
import { parseKeymap } from "../../src/parsers/keymap-parser";

const monaco = {
  KeyMod: {
    CtrlCmd: 2048,
    Shift: 1024,
    Alt: 512,
    WinCtrl: 256,
  },
  KeyCode: {
    Backspace: 1,
    Enter: 3,
    Space: 10,
    PageUp: 11,
    PageDown: 12,
    Home: 13,
    End: 14,
    LeftArrow: 15,
    UpArrow: 16,
    RightArrow: 17,
    DownArrow: 18,
    Delete: 20,
    Digit0: 21,
    Digit1: 22,
    Digit2: 23,
    Digit3: 24,
    Digit4: 25,
    Digit5: 26,
    Digit6: 27,
    Digit7: 28,
    Digit8: 29,
    Digit9: 30,
    KeyA: 31,
    KeyB: 32,
    KeyC: 33,
    KeyD: 34,
    KeyE: 35,
    KeyF: 36,
    KeyG: 37,
    KeyH: 38,
    KeyI: 39,
    KeyK: 41,
    KeyO: 45,
    KeyL: 42,
    KeyR: 48,
    KeyS: 49,
    KeyT: 50,
    KeyU: 51,
    KeyV: 52,
    F2: 60,
    F6: 64,
    F7: 65,
    F12: 70,
    Semicolon: 85,
    Equal: 86,
    Minus: 88,
    Slash: 90,
    BracketLeft: 92,
    BracketRight: 93,
    NumpadAdd: 109,
    NumpadSubtract: 111,
    NumpadDivide: 113,
  },
} as unknown as typeof Monaco;

const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));
const bindings = buildKeybindings(keymap, monaco);

function bindingFor(wsActionId: string, binding: number): number | undefined {
  return bindings.find((action) => action.wsActionId === wsActionId && action.monacoBinding === binding)?.monacoBinding;
}

describe("buildKeybindings", () => {
  test("maps extended leet hax shortcuts to Monaco bindings", () => {
    const M = monaco.KeyMod;
    const K = monaco.KeyCode;

    expect(bindingFor("MoveLineDown", M.Shift | M.Alt | K.DownArrow)).toBe(M.Shift | M.Alt | K.DownArrow);
    expect(bindingFor("MoveLineUp", M.Shift | M.Alt | K.UpArrow)).toBe(M.Shift | M.Alt | K.UpArrow);
    expect(bindingFor("MoveStatementDown", M.Shift | M.CtrlCmd | K.DownArrow)).toBe(M.Shift | M.CtrlCmd | K.DownArrow);
    expect(bindingFor("MoveStatementDown", M.Alt | K.KeyL)).toBe(M.Alt | K.KeyL);
    expect(bindingFor("MoveStatementUp", M.Shift | M.CtrlCmd | K.UpArrow)).toBe(M.Shift | M.CtrlCmd | K.UpArrow);
    expect(bindingFor("MoveStatementUp", M.Alt | K.KeyF)).toBe(M.Alt | K.KeyF);
    expect(bindingFor("MoveElementLeft", M.Alt | K.Home)).toBe(M.Alt | K.Home);
    expect(bindingFor("MoveElementLeft", M.Shift | M.WinCtrl | M.Alt | K.LeftArrow)).toBe(M.Shift | M.WinCtrl | M.Alt | K.LeftArrow);
    expect(bindingFor("MoveElementRight", M.Alt | K.End)).toBe(M.Alt | K.End);
    expect(bindingFor("MoveElementRight", M.Shift | M.WinCtrl | M.Alt | K.RightArrow)).toBe(M.Shift | M.WinCtrl | M.Alt | K.RightArrow);
    expect(bindingFor("MethodDown", M.WinCtrl | K.DownArrow)).toBe(M.WinCtrl | K.DownArrow);
    expect(bindingFor("MethodDown", M.CtrlCmd | M.Alt | K.KeyD)).toBe(M.CtrlCmd | M.Alt | K.KeyD);
    expect(bindingFor("MethodUp", M.WinCtrl | K.UpArrow)).toBe(M.WinCtrl | K.UpArrow);
    expect(bindingFor("MethodUp", M.CtrlCmd | M.Alt | K.KeyR)).toBe(M.CtrlCmd | M.Alt | K.KeyR);
    expect(bindingFor("Back", K.Home)).toBe(K.Home);
    expect(bindingFor("Back", M.CtrlCmd | K.BracketLeft)).toBe(M.CtrlCmd | K.BracketLeft);
    expect(bindingFor("Forward", M.CtrlCmd | K.BracketRight)).toBe(M.CtrlCmd | K.BracketRight);
    expect(bindingFor("Forward", K.End)).toBe(K.End);
    expect(bindingFor("EditorDeleteLine", M.Shift | K.Backspace)).toBe(M.Shift | K.Backspace);
    expect(bindingFor("EditorSelectWord", M.Alt | K.UpArrow)).toBe(M.Alt | K.UpArrow);
    expect(bindingFor("EditorUnSelectWord", M.Alt | K.DownArrow)).toBe(M.Alt | K.DownArrow);
    expect(bindingFor("EditorLineStart", M.WinCtrl | K.KeyA)).toBe(M.WinCtrl | K.KeyA);
    expect(bindingFor("EditorLineStart", M.CtrlCmd | K.LeftArrow)).toBe(M.CtrlCmd | K.LeftArrow);
    expect(bindingFor("EditorLineEnd", M.WinCtrl | K.KeyE)).toBe(M.WinCtrl | K.KeyE);
    expect(bindingFor("EditorLineEnd", M.WinCtrl | K.KeyT)).toBe(M.WinCtrl | K.KeyT);
    expect(bindingFor("EditorLineEnd", M.CtrlCmd | K.RightArrow)).toBe(M.CtrlCmd | K.RightArrow);
    expect(bindingFor("EditorLineStartWithSelection", M.Shift | K.Home)).toBe(M.Shift | K.Home);
    expect(bindingFor("EditorLineStartWithSelection", M.Shift | M.CtrlCmd | K.LeftArrow)).toBe(M.Shift | M.CtrlCmd | K.LeftArrow);
    expect(bindingFor("EditorLineStartWithSelection", M.Shift | M.WinCtrl | K.KeyA)).toBe(M.Shift | M.WinCtrl | K.KeyA);
    expect(bindingFor("EditorLineEndWithSelection", M.Shift | K.End)).toBe(M.Shift | K.End);
    expect(bindingFor("EditorLineEndWithSelection", M.Shift | M.CtrlCmd | K.RightArrow)).toBe(M.Shift | M.CtrlCmd | K.RightArrow);
    expect(bindingFor("EditorLineEndWithSelection", M.Shift | M.WinCtrl | K.KeyT)).toBe(M.Shift | M.WinCtrl | K.KeyT);
    expect(bindingFor("EditorDeleteToLineStart", M.CtrlCmd | K.Backspace)).toBe(M.CtrlCmd | K.Backspace);
    expect(bindingFor("EditorNextWord", M.Alt | K.RightArrow)).toBe(M.Alt | K.RightArrow);
    expect(bindingFor("EditorNextWord", M.CtrlCmd | M.Alt | K.KeyT)).toBe(M.CtrlCmd | M.Alt | K.KeyT);
    expect(bindingFor("EditorPreviousWord", M.Alt | K.LeftArrow)).toBe(M.Alt | K.LeftArrow);
    expect(bindingFor("EditorPreviousWord", M.CtrlCmd | M.Alt | K.KeyA)).toBe(M.CtrlCmd | M.Alt | K.KeyA);
    expect(bindingFor("EditorNextWordWithSelection", M.Shift | M.Alt | K.RightArrow)).toBe(M.Shift | M.Alt | K.RightArrow);
    expect(bindingFor("EditorNextWordWithSelection", M.Shift | M.CtrlCmd | M.Alt | K.KeyT)).toBe(M.Shift | M.CtrlCmd | M.Alt | K.KeyT);
    expect(bindingFor("EditorPreviousWordWithSelection", M.Shift | M.Alt | K.LeftArrow)).toBe(M.Shift | M.Alt | K.LeftArrow);
    expect(bindingFor("EditorPreviousWordWithSelection", M.Shift | M.CtrlCmd | M.Alt | K.KeyA)).toBe(M.Shift | M.CtrlCmd | M.Alt | K.KeyA);
    expect(bindingFor("AutoIndentLines", M.CtrlCmd | K.KeyI)).toBe(M.CtrlCmd | K.KeyI);
    expect(bindingFor("EditorDownWithSelection", M.Shift | M.Alt | K.KeyD)).toBe(M.Shift | M.Alt | K.KeyD);
    expect(bindingFor("EditorDownWithSelection", M.Shift | M.Alt | K.KeyS)).toBe(M.Shift | M.Alt | K.KeyS);
    expect(bindingFor("EditorUpWithSelection", M.Shift | M.Alt | K.KeyR)).toBe(M.Shift | M.Alt | K.KeyR);
    expect(bindingFor("EditorUpWithSelection", M.Shift | M.Alt | K.KeyH)).toBe(M.Shift | M.Alt | K.KeyH);
    expect(bindingFor("EditorMoveDownAndScroll", M.Shift | M.WinCtrl | K.PageDown)).toBe(M.Shift | M.WinCtrl | K.PageDown);
    expect(bindingFor("EditorMoveUpAndScroll", M.Shift | M.WinCtrl | K.PageUp)).toBe(M.Shift | M.WinCtrl | K.PageUp);
    expect(bindingFor("EditorPageUp", 0)).toBe(0);
    expect(bindingFor("EditorPageDown", 0)).toBe(0);
    expect(bindingFor("EditorScrollToCenter", 0)).toBe(0);
    expect(bindingFor("EditorSplitLine", 0)).toBe(0);
    expect(bindingFor("EditorCloneCaretAbove", K.PageUp)).toBe(K.PageUp);
    expect(bindingFor("EditorCloneCaretBelow", K.PageDown)).toBe(K.PageDown);
    expect(bindingFor("CollapseRegion", M.Alt | K.Minus)).toBe(M.Alt | K.Minus);
    expect(bindingFor("ExpandRegion", M.Alt | K.Equal)).toBe(M.Alt | K.Equal);
    expect(bindingFor("CollapseRegionRecursively", M.CtrlCmd | M.Alt | K.Minus)).toBe(M.CtrlCmd | M.Alt | K.Minus);
    expect(bindingFor("ExpandRegionRecursively", M.CtrlCmd | M.Alt | K.Equal)).toBe(M.CtrlCmd | M.Alt | K.Equal);
    expect(bindingFor("CollapseAllRegions", M.Shift | M.WinCtrl | K.Minus)).toBe(M.Shift | M.WinCtrl | K.Minus);
    expect(bindingFor("ExpandAllRegions", M.Shift | M.CtrlCmd | K.Equal)).toBe(M.Shift | M.CtrlCmd | K.Equal);
    expect(bindingFor("CollapseAll", 0)).toBe(0);
    expect(bindingFor("ExpandAll", 0)).toBe(0);
    expect(bindingFor("CollapseSelection", 0)).toBe(0);
    expect(bindingFor("CommentByBlockComment", M.CtrlCmd | M.Alt | K.Slash)).toBe(M.CtrlCmd | M.Alt | K.Slash);
    expect(bindingFor("HippieCompletion", M.Shift | M.CtrlCmd | K.Slash)).toBe(M.Shift | M.CtrlCmd | K.Slash);
    expect(bindingFor("HippieCompletion", M.WinCtrl | K.KeyL)).toBe(M.WinCtrl | K.KeyL);
    expect(bindingFor("HippieBackwardCompletion", M.Shift | M.Alt | K.Slash)).toBe(M.Shift | M.Alt | K.Slash);
    expect(bindingFor("HippieBackwardCompletion", M.Shift | M.CtrlCmd | M.Alt | K.Slash)).toBe(M.Shift | M.CtrlCmd | M.Alt | K.Slash);
    expect(bindingFor("HippieBackwardCompletion", M.WinCtrl | K.KeyD)).toBe(M.WinCtrl | K.KeyD);
    expect(bindingFor("GotoNextError", K.F2)).toBe(K.F2);
    expect(bindingFor("GotoTypeDeclaration", M.Shift | M.WinCtrl | K.KeyB)).toBe(M.Shift | M.WinCtrl | K.KeyB);
    expect(bindingFor("FileStructurePopup", M.CtrlCmd | K.F12)).toBe(M.CtrlCmd | K.F12);
    expect(bindingFor("FileStructurePopup", M.Shift | M.CtrlCmd | K.KeyS)).toBe(M.Shift | M.CtrlCmd | K.KeyS);
    expect(bindingFor("GotoClass", M.Shift | M.CtrlCmd | K.KeyO)).toBe(M.Shift | M.CtrlCmd | K.KeyO);
    expect(bindingFor("GotoFile", M.CtrlCmd | K.KeyO)).toBe(M.CtrlCmd | K.KeyO);
    expect(bindingFor("MoveTabRight", M.Shift | M.WinCtrl | K.KeyI)).toBe(M.Shift | M.WinCtrl | K.KeyI);
    expect(bindingFor("AceJumpAction", M.CtrlCmd | K.Semicolon)).toBe(M.CtrlCmd | K.Semicolon);
    expect(bindingFor("AceJumpAction", M.WinCtrl | K.Semicolon)).toBe(M.WinCtrl | K.Semicolon);
    expect(bindingFor("AceJumpAction", M.CtrlCmd | K.KeyI)).toBe(M.CtrlCmd | K.KeyI);
    expect(bindingFor("RecentLocations", M.CtrlCmd | M.Alt | K.KeyL)).toBe(M.CtrlCmd | M.Alt | K.KeyL);
    expect(bindingFor("SearchEverywhere", M.WinCtrl | M.CtrlCmd | M.Alt | K.KeyF)).toBe(M.WinCtrl | M.CtrlCmd | M.Alt | K.KeyF);
    expect(bindingFor("Replace", 0)).toBe(0);
    expect(bindingFor("ReplaceInPath", M.CtrlCmd | M.Alt | K.KeyR)).toBe(M.CtrlCmd | M.Alt | K.KeyR);
    expect(bindingFor("ShowIntentionActions", M.Shift | M.Alt | K.Enter)).toBe(M.Shift | M.Alt | K.Enter);
    expect(bindingFor("EditorStartNewLine", M.Alt | K.Enter)).toBe(M.Alt | K.Enter);
    expect(bindingFor("EditorStartNewLine", M.Alt | K.Space)).toBe(M.Alt | K.Space);
    expect(bindingFor("EditorStartNewLineBefore", M.CtrlCmd | K.Enter)).toBe(M.CtrlCmd | K.Enter);
    expect(bindingFor("EditorStartNewLineBefore", M.CtrlCmd | M.Shift | K.Space)).toBe(M.CtrlCmd | M.Shift | K.Space);
    expect(bindingFor("IntroduceActionsGroup", M.Shift | M.CtrlCmd | K.KeyE)).toBe(M.Shift | M.CtrlCmd | K.KeyE);
    expect(bindingFor("RenameElement", M.CtrlCmd | K.KeyR)).toBe(M.CtrlCmd | K.KeyR);
    expect(bindingFor("RenameElement", M.Shift | K.F6)).toBe(M.Shift | K.F6);
    expect(bindingFor("ShowUsages", M.CtrlCmd | M.Alt | K.F7)).toBe(M.CtrlCmd | M.Alt | K.F7);
    expect(bindingFor("ReformatCode", M.Shift | M.CtrlCmd | K.Semicolon)).toBe(M.Shift | M.CtrlCmd | K.Semicolon);
    expect(bindingFor("RearrangeCode", M.Shift | M.CtrlCmd | K.KeyI)).toBe(M.Shift | M.CtrlCmd | K.KeyI);
    expect(bindingFor("EditorDeleteToWordStartInDifferentHumpsMode", M.CtrlCmd | K.KeyK)).toBe(M.CtrlCmd | K.KeyK);
    expect(bindingFor("EditorDeleteToWordEndInDifferentHumpsMode", M.CtrlCmd | K.KeyU)).toBe(M.CtrlCmd | K.KeyU);
    expect(bindingFor("EditorToggleCase", M.Shift | M.CtrlCmd | K.KeyU)).toBe(M.Shift | M.CtrlCmd | K.KeyU);
    expect(bindingFor("SelectNextOccurrence", M.Alt | K.KeyG)).toBe(M.Alt | K.KeyG);
    expect(bindingFor("SelectAllOccurrences", M.CtrlCmd | M.Alt | K.KeyG)).toBe(M.CtrlCmd | M.Alt | K.KeyG);
    expect(bindingFor("UnselectPreviousOccurrence", M.Shift | M.Alt | K.KeyG)).toBe(M.Shift | M.Alt | K.KeyG);
    expect(bindingFor("EditorNextWordInDifferentHumpsMode", M.CtrlCmd | M.Alt | K.RightArrow)).toBe(M.CtrlCmd | M.Alt | K.RightArrow);
    expect(bindingFor("EditorPreviousWordInDifferentHumpsMode", M.CtrlCmd | M.Alt | K.LeftArrow)).toBe(M.CtrlCmd | M.Alt | K.LeftArrow);
    expect(bindingFor("EditorNextWordInDifferentHumpsModeWithSelection", M.Shift | M.CtrlCmd | M.Alt | K.RightArrow)).toBe(M.Shift | M.CtrlCmd | M.Alt | K.RightArrow);
    expect(bindingFor("EditorPreviousWordInDifferentHumpsModeWithSelection", M.Shift | M.CtrlCmd | M.Alt | K.LeftArrow)).toBe(M.Shift | M.CtrlCmd | M.Alt | K.LeftArrow);
  });

  test("maps choose lookup complete statement to shift-cmd-enter only", () => {
    const M = monaco.KeyMod;
    const K = monaco.KeyCode;

    expect(bindingFor("EditorChooseLookupItemCompleteStatement", M.Shift | M.CtrlCmd | K.Enter)).toBe(M.Shift | M.CtrlCmd | K.Enter);
    expect(bindingFor("EditorChooseLookupItemCompleteStatement", K.Enter)).toBeUndefined();
  });

  test("maps WebStorm alt+number tab shortcuts to deterministic Monaco bindings", () => {
    const M = monaco.KeyMod;
    const K = monaco.KeyCode;

    expect(bindingFor("GoToTab1", M.Alt | K.Digit1)).toBe(M.Alt | K.Digit1);
    expect(bindingFor("GoToTab2", M.Alt | K.Digit2)).toBe(M.Alt | K.Digit2);
    expect(bindingFor("Go To Tab #9", M.Alt | K.Digit9)).toBe(M.Alt | K.Digit9);
    expect(bindingFor("Switch To Tab #9", M.Alt | K.Digit9)).toBe(M.Alt | K.Digit9);
    expect(bindingFor("Go To Tab #10", M.Alt | K.Digit0)).toBe(M.Alt | K.Digit0);
    expect(bindingFor("Switch To Tab #10", M.Alt | K.Digit0)).toBe(M.Alt | K.Digit0);
  });

  test("maps digit key tokens 3 through 9 to Monaco digit key codes", () => {
    const digitBindings = buildKeybindings(
      {
        name: "digits",
        parent: "",
        actions: [{ id: "EditorResetFontSize", shortcuts: ["3", "4", "5", "6", "7", "8", "9"] }],
      },
      monaco,
    );

    expect(digitBindings.map((action) => action.monacoBinding)).toEqual([
      monaco.KeyCode.Digit3,
      monaco.KeyCode.Digit4,
      monaco.KeyCode.Digit5,
      monaco.KeyCode.Digit6,
      monaco.KeyCode.Digit7,
      monaco.KeyCode.Digit8,
      monaco.KeyCode.Digit9,
    ]);
  });

  test("omits unmapped actions", () => {
    expect(bindings.some((action) => action.wsActionId === "DefinitelyNotAnAction")).toBe(false);
  });
});

describe("registerKeybindings", () => {
  test("tracks selected occurrences and unselects the previous occurrence", () => {
    const selection = (id: number) => ({
      id,
      equalsSelection: (other: { id: number }) => other.id === id,
    });
    const first = selection(1);
    const second = selection(2);
    const third = selection(3);
    const additions = [second, third];
    let selections = [first];
    const commands = new Map<number, () => void>();
    const setSelections = vi.fn((next: typeof selections) => {
      selections = next;
    });
    const editor = {
      addCommand: vi.fn((binding: number, handler: () => void) => {
        commands.set(binding, handler);
        return `command-${binding}`;
      }),
      getAction: vi.fn(() => ({
        run: vi.fn(() => {
          const next = additions.shift();

          if (next) {
            selections = [...selections, next];
          }
        }),
      })),
      getSelections: () => selections,
      setSelections,
    } as never;
    const M = monaco.KeyMod;
    const K = monaco.KeyCode;

    registerKeybindings(editor, monaco, {
      name: "test",
      parent: "",
      actions: [
        { id: "SelectNextOccurrence", shortcuts: ["alt g"] },
        { id: "UnselectPreviousOccurrence", shortcuts: ["shift alt g"] },
      ],
    });

    commands.get(M.Alt | K.KeyG)?.();
    commands.get(M.Alt | K.KeyG)?.();
    selections = [first, third, second];
    commands.get(M.Shift | M.Alt | K.KeyG)?.();

    expect(setSelections).toHaveBeenCalledWith([first, second]);
  });

  test("ace jump focuses the editor and opens Monaco goto line", () => {
    const commands = new Map<number, () => void>();
    const focus = vi.fn();
    const gotoLineAction = { run: vi.fn() };
    const getAction = vi.fn((id: string) => (id === "editor.action.gotoLine" ? gotoLineAction : undefined));
    const editor = {
      addCommand: vi.fn((binding: number, handler: () => void) => {
        commands.set(binding, handler);
        return `command-${binding}`;
      }),
      focus,
      getAction,
    } as never;
    const binding = monaco.KeyMod.CtrlCmd | monaco.KeyCode.Semicolon;

    registerKeybindings(editor, monaco, {
      name: "test",
      parent: "",
      actions: [{ id: "AceJumpAction", shortcuts: ["meta semicolon"] }],
    });

    commands.get(binding)?.();

    expect(focus).toHaveBeenCalled();
    expect(getAction).toHaveBeenCalledWith("editor.action.gotoLine");
    expect(gotoLineAction.run).toHaveBeenCalled();
  });

  test("replace opens Monaco's find/replace action without a shortcut", () => {
    const commands = new Map<number, () => void>();
    const focus = vi.fn();
    const replaceAction = { run: vi.fn() };
    const getAction = vi.fn((id: string) => (id === "editor.action.startFindReplaceAction" ? replaceAction : undefined));
    const editor = {
      addCommand: vi.fn((binding: number, handler: () => void) => {
        commands.set(binding, handler);
        return `command-${binding}`;
      }),
      focus,
      getAction,
    } as never;

    registerKeybindings(editor, monaco, {
      name: "test",
      parent: "",
      actions: [{ id: "Replace", shortcuts: [] }],
    });

    commands.get(0)?.();

    expect(focus).toHaveBeenCalled();
    expect(getAction).toHaveBeenCalledWith("editor.action.startFindReplaceAction");
    expect(replaceAction.run).toHaveBeenCalled();
  });

  test("shortcutless folding actions run Monaco's built-in folding actions", () => {
    const commands = new Map<string, () => void>();
    const monacoActions = new Map([
      ["editor.foldAll", { run: vi.fn() }],
      ["editor.unfoldAll", { run: vi.fn() }],
      ["editor.fold", { run: vi.fn() }],
    ]);
    const getAction = vi.fn((id: string) => monacoActions.get(id));
    const editor = {
      addCommand: vi.fn((_binding: number, handler: () => void) => {
        const commandId = `command-${commands.size + 1}`;

        commands.set(commandId, handler);
        return commandId;
      }),
      getAction,
    } as never;

    const registered = registerKeybindings(editor, monaco, {
      name: "test",
      parent: "",
      actions: [
        { id: "CollapseAll", shortcuts: [] },
        { id: "ExpandAll", shortcuts: [] },
        { id: "CollapseSelection", shortcuts: [] },
      ],
    });

    for (const [wsActionId, monacoActionId] of [
      ["CollapseAll", "editor.foldAll"],
      ["ExpandAll", "editor.unfoldAll"],
      ["CollapseSelection", "editor.fold"],
    ] as const) {
      const registeredAction = registered.find((action) => action.wsActionId === wsActionId);

      expect(registeredAction?.monacoBinding).toBe(0);
      commands.get(registeredAction?.commandId ?? "")?.();
      expect(getAction).toHaveBeenCalledWith(monacoActionId);
      expect(monacoActions.get(monacoActionId)?.run).toHaveBeenCalled();
    }
  });

  test("rename element runs Monaco's built-in rename action", () => {
    const commands = new Map<number, () => void>();
    const renameAction = { run: vi.fn() };
    const getAction = vi.fn((id: string) => (id === "editor.action.rename" ? renameAction : undefined));
    const editor = {
      addCommand: vi.fn((binding: number, handler: () => void) => {
        commands.set(binding, handler);
        return `command-${binding}`;
      }),
      getAction,
    } as never;
    const binding = monaco.KeyMod.Shift | monaco.KeyCode.F6;

    registerKeybindings(editor, monaco, {
      name: "test",
      parent: "",
      actions: [{ id: "RenameElement", shortcuts: ["shift f6"] }],
    });

    commands.get(binding)?.();

    expect(getAction).toHaveBeenCalledWith("editor.action.rename");
    expect(renameAction.run).toHaveBeenCalled();
  });

  test("choose lookup complete accepts the selected suggestion before completing the statement", async () => {
    vi.resetModules();
    const completeStatementWhenReady = vi.fn();
    vi.doMock("../../src/ast-smart-selection", () => ({
      completeStatementWhenReady,
      expandAstSelectionWhenReady: vi.fn(),
      moveElementWhenReady: vi.fn(),
      moveStatementWhenReady: vi.fn(),
      navigateMethodWhenReady: vi.fn(),
    }));
    const { registerKeybindings: registerWithMockedAst } = await import("../../src/keybindings");
    const commands = new Map<number, () => void>();
    const trigger = vi.fn();
    const editor = {
      addCommand: vi.fn((binding: number, handler: () => void) => {
        commands.set(binding, handler);
        return `command-${binding}`;
      }),
      trigger,
    } as never;
    const binding = monaco.KeyMod.Shift | monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter;

    vi.useFakeTimers();
    try {
      registerWithMockedAst(editor, monaco, {
        name: "test",
        parent: "",
        actions: [{ id: "EditorChooseLookupItemCompleteStatement", shortcuts: ["shift meta enter", "enter"] }],
      });

      commands.get(binding)?.();

      expect(commands.has(monaco.KeyCode.Enter)).toBe(false);
      expect(trigger).toHaveBeenCalledWith("keyboard", "acceptSelectedSuggestion", {});
      expect(completeStatementWhenReady).not.toHaveBeenCalled();

      vi.runOnlyPendingTimers();

      expect(completeStatementWhenReady).toHaveBeenCalledWith(editor, undefined, { ignoreWidgetFocus: true });
    } finally {
      vi.useRealTimers();
      vi.doUnmock("../../src/ast-smart-selection");
      vi.resetModules();
    }
  });
});

describe("removeLastSelection", () => {
  test("removes the most recently added selection", () => {
    const selections = [{ id: 1 }, { id: 2 }, { id: 3 }] as never;
    const setSelections = vi.fn();

    removeLastSelection({ getSelections: () => selections, setSelections });

    expect(setSelections).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
  });

  test("keeps zero or one selection unchanged", () => {
    const setSelections = vi.fn();

    removeLastSelection({ getSelections: () => [], setSelections });
    removeLastSelection({ getSelections: () => [{ id: 1 }] as never, setSelections });

    expect(setSelections).not.toHaveBeenCalled();
  });
});
