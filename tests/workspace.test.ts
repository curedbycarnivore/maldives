import { describe, expect, test, vi } from "vitest";
import { MaldivesWorkspace } from "../src/workspace";

interface FakeModel {
  uri: { toString: () => string };
  onDidChangeContent: (listener: () => void) => { dispose: () => void };
  isDisposed: () => boolean;
  dispose: () => void;
  mutate: () => void;
}

describe("MaldivesWorkspace", () => {
  test("opens, switches, closes, tracks dirty state, and restores per-model view state", () => {
    const models = new Map<string, FakeModel>();
    const createModel = vi.fn((uri: string): FakeModel => {
      const model = fakeModel(uri);
      models.set(uri, model);
      return model;
    });
    let activeModel: FakeModel | null = null;
    let nextViewState = { cursor: "sample.ts:3:5" };
    const editor = {
      setModel: vi.fn((model: FakeModel | null) => {
        activeModel = model;
      }),
      saveViewState: vi.fn(() => nextViewState),
      restoreViewState: vi.fn(),
      focus: vi.fn(),
    };
    const workspace = new MaldivesWorkspace({ createModel, editor: editor as never });

    const sample = workspace.open("file:///maldives/sample.ts", "const sample = 1;");
    const effect = workspace.open("file:///maldives/effect.tsx", "const effect = 2;");

    expect(createModel).toHaveBeenCalledTimes(2);
    expect(workspace.activeUri).toBe("file:///maldives/effect.tsx");
    expect(activeModel).toBe(effect);
    expect(workspace.uris()).toEqual(["file:///maldives/sample.ts", "file:///maldives/effect.tsx"]);
    expect(workspace.isDirty("file:///maldives/sample.ts")).toBe(false);

    sample.mutate();
    expect(workspace.isDirty("file:///maldives/sample.ts")).toBe(true);
    workspace.markClean("file:///maldives/sample.ts");
    expect(workspace.isDirty("file:///maldives/sample.ts")).toBe(false);

    nextViewState = { cursor: "effect.tsx:8:11" };
    expect(workspace.switchTo("file:///maldives/sample.ts")).toBe(true);
    expect(activeModel).toBe(sample);
    expect(editor.restoreViewState).toHaveBeenCalledWith({ cursor: "sample.ts:3:5" });

    nextViewState = { cursor: "sample.ts:4:9" };
    expect(workspace.switchTo("file:///maldives/effect.tsx")).toBe(true);
    expect(activeModel).toBe(effect);
    expect(editor.restoreViewState).toHaveBeenCalledWith({ cursor: "effect.tsx:8:11" });

    expect(workspace.close("file:///maldives/effect.tsx")).toBe(true);
    expect(effect.isDisposed()).toBe(true);
    expect(workspace.activeUri).toBe("file:///maldives/sample.ts");
    expect(activeModel).toBe(sample);
    expect(workspace.close("file:///maldives/missing.ts")).toBe(false);
  });
});

function fakeModel(uri: string): FakeModel {
  const listeners = new Set<() => void>();
  let disposed = false;

  return {
    uri: { toString: () => uri },
    onDidChangeContent(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    isDisposed: () => disposed,
    dispose: () => {
      disposed = true;
    },
    mutate: () => {
      for (const listener of listeners) listener();
    },
  };
}
