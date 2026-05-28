import { describe, expect, test, vi } from "vitest";
import { scrollCurrentLineToCenter, splitLineAtCursor } from "../../src/keybindings";

describe("viewport and line-structure commands", () => {
  test("scrollCurrentLineToCenter reveals the current cursor line in the center", () => {
    const revealLineInCenter = vi.fn();
    const focus = vi.fn();
    const editor = {
      getPosition: () => ({ lineNumber: 42, column: 7 }),
      revealLineInCenter,
      focus,
    };

    scrollCurrentLineToCenter(editor as never);

    expect(revealLineInCenter).toHaveBeenCalledWith(42);
    expect(focus).toHaveBeenCalledOnce();
  });

  test("splitLineAtCursor inserts a newline at the cursor without moving it", () => {
    const executeEdits = vi.fn();
    const setPosition = vi.fn();
    const focus = vi.fn();
    const editor = {
      getPosition: () => ({ lineNumber: 3, column: 6 }),
      executeEdits,
      setPosition,
      focus,
    };

    splitLineAtCursor(editor as never);

    expect(executeEdits).toHaveBeenCalledWith("maldives", [
      {
        range: {
          startLineNumber: 3,
          startColumn: 6,
          endLineNumber: 3,
          endColumn: 6,
        },
        text: "\n",
      },
    ]);
    expect(setPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 6 });
    expect(focus).toHaveBeenCalledOnce();
  });
});
