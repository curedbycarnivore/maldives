import { describe, expect, test, vi } from "vitest";
import { registerKeybindings } from "../src/keybindings";
import type { KeymapConfig } from "../src/parsers/keymap-parser";
import { saveActiveWorkspaceFile } from "../src/read-write-mode";

const fakeMonaco = {
  KeyMod: { CtrlCmd: 1 << 11, WinCtrl: 1 << 8, Shift: 1 << 10, Alt: 1 << 9 },
  KeyCode: { KeyU: 34, KeyD: 33 },
} as never;

describe("read/write mode safety", () => {
  test("custom edit keybindings are disabled in read mode and registered behind the write-mode context", () => {
    const commands: Array<{ binding: number; handler: () => void; precondition?: string }> = [];
    const editor = {
      addAction: vi.fn(),
      addCommand: vi.fn((binding: number, handler: () => void, precondition?: string) => {
        commands.push({ binding, handler, precondition });
        return `cmd-${commands.length}`;
      }),
      getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
      trigger: vi.fn(),
      executeEdits: vi.fn(),
    };
    const config: KeymapConfig = {
      name: "test",
      parent: "Mac OS X 10.5+",
      actions: [{ id: "EditorDeleteToWordEndInDifferentHumpsMode", shortcuts: ["meta u"] }],
    };

    registerKeybindings(editor as never, fakeMonaco, config, { isWriteMode: () => false, writeModeContextKey: "maldivesWriteMode" });
    commands[0]?.handler();

    expect(commands[0]?.precondition).toBe("maldivesWriteMode");
    expect(editor.executeEdits).not.toHaveBeenCalled();
  });

  test("saving is blocked in read mode and writes the active file only in write mode", async () => {
    const adapter = { writeFile: vi.fn(async () => undefined) };
    const workspace = {
      mode: "read" as "read" | "write",
      activeUri: "file:///effect-app.tsx",
      markClean: vi.fn(() => true),
    };
    const editor = { getValue: vi.fn(() => "const saved = true;\n") };
    const notify = vi.fn();

    await expect(saveActiveWorkspaceFile({ adapter: adapter as never, workspace, editor: editor as never, notify, userGesture: true })).resolves.toBe(false);
    expect(adapter.writeFile).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("Switch to Write mode to edit");

    workspace.mode = "write";
    await expect(saveActiveWorkspaceFile({ adapter: adapter as never, workspace, editor: editor as never, notify, userGesture: true, confirm: () => true })).resolves.toBe(true);
    expect(adapter.writeFile).toHaveBeenCalledWith("/effect-app.tsx", "const saved = true;\n", { userGesture: true });
    expect(workspace.markClean).toHaveBeenCalledWith("file:///effect-app.tsx");
  });
});
