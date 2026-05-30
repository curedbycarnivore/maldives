import { describe, expect, test, vi } from "vitest";
import { MaldivesWorkspace } from "../src/workspace";

function fakeModel() {
  return {
    onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
  };
}

describe("MaldivesWorkspace read/write mode", () => {
  test("defaults to read-only and flips Monaco readOnly through explicit mode changes", () => {
    const editor = {
      setModel: vi.fn(),
      updateOptions: vi.fn(),
      focus: vi.fn(),
    };
    const workspace = new MaldivesWorkspace({
      createModel: vi.fn(() => fakeModel() as never),
      editor: editor as never,
    });

    expect(workspace.mode).toBe("read");
    expect(editor.updateOptions).toHaveBeenCalledWith({ readOnly: true });

    expect(workspace.toggleMode()).toBe("write");
    expect(workspace.mode).toBe("write");
    expect(editor.updateOptions).toHaveBeenLastCalledWith({ readOnly: false });

    workspace.setMode("read");
    expect(workspace.mode).toBe("read");
    expect(editor.updateOptions).toHaveBeenLastCalledWith({ readOnly: true });
  });
});
