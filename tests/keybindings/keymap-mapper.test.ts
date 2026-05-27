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
    Digit1: 22,
    Digit2: 23,
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
    KeyL: 42,
    KeyR: 48,
    KeyS: 49,
    KeyT: 50,
    KeyU: 51,
    KeyV: 52,
    F2: 60,
    F6: 64,
    F7: 65,
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
    expect(bindingFor("MoveStatementUp", M.Shift | M.CtrlCmd | K.UpArrow)).toBe(M.Shift | M.CtrlCmd | K.UpArrow);
    expect(bindingFor("Back", M.CtrlCmd | K.BracketLeft)).toBe(M.CtrlCmd | K.BracketLeft);
    expect(bindingFor("Forward", M.CtrlCmd | K.BracketRight)).toBe(M.CtrlCmd | K.BracketRight);
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
    expect(bindingFor("EditorCloneCaretAbove", K.PageUp)).toBe(K.PageUp);
    expect(bindingFor("EditorCloneCaretBelow", K.PageDown)).toBe(K.PageDown);
    expect(bindingFor("CollapseRegion", M.Alt | K.Minus)).toBe(M.Alt | K.Minus);
    expect(bindingFor("ExpandRegion", M.Alt | K.Equal)).toBe(M.Alt | K.Equal);
    expect(bindingFor("CollapseRegionRecursively", M.CtrlCmd | M.Alt | K.Minus)).toBe(M.CtrlCmd | M.Alt | K.Minus);
    expect(bindingFor("ExpandRegionRecursively", M.CtrlCmd | M.Alt | K.Equal)).toBe(M.CtrlCmd | M.Alt | K.Equal);
    expect(bindingFor("CollapseAllRegions", M.Shift | M.WinCtrl | K.Minus)).toBe(M.Shift | M.WinCtrl | K.Minus);
    expect(bindingFor("ExpandAllRegions", M.Shift | M.CtrlCmd | K.Equal)).toBe(M.Shift | M.CtrlCmd | K.Equal);
    expect(bindingFor("CommentByBlockComment", M.CtrlCmd | M.Alt | K.Slash)).toBe(M.CtrlCmd | M.Alt | K.Slash);
    expect(bindingFor("GotoNextError", K.F2)).toBe(K.F2);
    expect(bindingFor("GotoTypeDeclaration", M.Shift | M.WinCtrl | K.KeyB)).toBe(M.Shift | M.WinCtrl | K.KeyB);
    expect(bindingFor("ShowIntentionActions", M.Shift | M.Alt | K.Enter)).toBe(M.Shift | M.Alt | K.Enter);
    expect(bindingFor("EditorStartNewLine", M.Alt | K.Enter)).toBe(M.Alt | K.Enter);
    expect(bindingFor("EditorStartNewLine", M.Alt | K.Space)).toBe(M.Alt | K.Space);
    expect(bindingFor("EditorStartNewLineBefore", M.CtrlCmd | K.Enter)).toBe(M.CtrlCmd | K.Enter);
    expect(bindingFor("EditorStartNewLineBefore", M.CtrlCmd | M.Shift | K.Space)).toBe(M.CtrlCmd | M.Shift | K.Space);
    expect(bindingFor("RenameElement", M.CtrlCmd | K.KeyR)).toBe(M.CtrlCmd | K.KeyR);
    expect(bindingFor("ShowUsages", M.CtrlCmd | M.Alt | K.F7)).toBe(M.CtrlCmd | M.Alt | K.F7);
    expect(bindingFor("ReformatCode", M.Shift | M.CtrlCmd | K.Semicolon)).toBe(M.Shift | M.CtrlCmd | K.Semicolon);
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

  test("omits unmapped actions", () => {
    expect(bindings.some((action) => action.wsActionId === "AceJumpAction")).toBe(false);
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
