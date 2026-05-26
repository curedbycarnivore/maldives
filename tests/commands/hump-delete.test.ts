import { describe, expect, test, vi } from "vitest";
import { deleteToWordPart } from "../../src/keybindings";

function makeEditor(startColumn: number, endColumn: number) {
  let column = startColumn;
  const trigger = vi.fn((_source: string, command: string) => {
    expect(command).toMatch(/^cursorWordPart(Left|Right)$/);
    column = endColumn;
  });
  const executeEdits = vi.fn();

  return {
    editor: {
      getPosition: () => ({ lineNumber: 1, column }),
      trigger,
      executeEdits,
    } as never,
    trigger,
    executeEdits,
  };
}

describe("deleteToWordPart", () => {
  test("deletes forward to the next hump boundary", () => {
    const { editor, trigger, executeEdits } = makeEditor(6, 10);

    deleteToWordPart(editor, "right");

    expect(trigger).toHaveBeenCalledWith("maldives", "cursorWordPartRight", null);
    expect(executeEdits).toHaveBeenCalledWith("maldives", [
      {
        range: { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 10 },
        text: "",
      },
    ]);
  });

  test("deletes backward to the previous hump boundary", () => {
    const { editor, trigger, executeEdits } = makeEditor(10, 6);

    deleteToWordPart(editor, "left");

    expect(trigger).toHaveBeenCalledWith("maldives", "cursorWordPartLeft", null);
    expect(executeEdits).toHaveBeenCalledWith("maldives", [
      {
        range: { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 10 },
        text: "",
      },
    ]);
  });
});
