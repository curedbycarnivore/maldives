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
    PageUp: 11,
    PageDown: 12,
    LeftArrow: 15,
    UpArrow: 16,
    RightArrow: 17,
    DownArrow: 18,
    Delete: 20,
    Digit1: 22,
    Digit2: 23,
    KeyB: 32,
    KeyC: 33,
    KeyD: 34,
    KeyF: 36,
    KeyG: 37,
    KeyK: 41,
    KeyL: 42,
    KeyR: 48,
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
    expect(bindingFor("EditorDeleteLine", M.Shift | K.Backspace)).toBe(M.Shift | K.Backspace);
    expect(bindingFor("EditorSelectWord", M.Alt | K.UpArrow)).toBe(M.Alt | K.UpArrow);
    expect(bindingFor("EditorUnSelectWord", M.Alt | K.DownArrow)).toBe(M.Alt | K.DownArrow);
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
