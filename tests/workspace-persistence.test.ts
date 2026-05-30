import { describe, expect, test, vi } from "vitest";
import { captureWorkspaceSnapshot, installWorkspacePersistence, restoreWorkspaceSnapshot, type WorkspacePersistenceSnapshot } from "../src/workspace-persistence";
import { MaldivesWorkspace } from "../src/workspace";

interface FakeModel {
  uri: { toString: () => string };
  getValue: () => string;
  setValue: (value: string) => void;
  onDidChangeContent: (listener: () => void) => { dispose: () => void };
  dispose: () => void;
}

describe("workspace persistence", () => {
  test("captures and restores open tabs, content, active uri, dirty state, and cursor positions", () => {
    const models = new Map<string, FakeModel>();
    let activeModel: FakeModel | null = null;
    let cursor = { lineNumber: 1, column: 1 };
    const cursorListeners = new Set<() => void>();
    const editor = {
      setModel: vi.fn((model: FakeModel | null) => {
        activeModel = model;
      }),
      saveViewState: vi.fn(),
      restoreViewState: vi.fn(),
      getPosition: vi.fn(() => cursor),
      setPosition: vi.fn((position: { lineNumber: number; column: number }) => {
        cursor = position;
      }),
      onDidChangeCursorPosition: vi.fn((listener: () => void) => {
        cursorListeners.add(listener);
        return { dispose: () => cursorListeners.delete(listener) };
      }),
      focus: vi.fn(),
    };
    const createModel = vi.fn((uri: string, content: string): FakeModel => {
      const model = fakeModel(uri, content);
      models.set(uri, model);
      return model;
    });
    const workspace = new MaldivesWorkspace({ createModel, editor: editor as never });

    workspace.open("file:///p16a3/app.tsx", "class P16A3App {}\n");
    cursor = { lineNumber: 1, column: 7 };
    workspace.open("file:///p16a3/repo.ts", "export class Repo {}\n");
    cursor = { lineNumber: 1, column: 14 };
    workspace.switchTo("file:///p16a3/app.tsx");
    activeModel?.setValue("class P16A3App { readonly dirty = true }\n");

    const snapshot = captureWorkspaceSnapshot(workspace, editor as never);
    expect(snapshot).toEqual<WorkspacePersistenceSnapshot>({
      version: 1,
      activeUri: "file:///p16a3/app.tsx",
      files: [
        { uri: "file:///p16a3/app.tsx", content: "class P16A3App { readonly dirty = true }\n", cursor: { lineNumber: 1, column: 7 } },
        { uri: "file:///p16a3/repo.ts", content: "export class Repo {}\n", cursor: { lineNumber: 1, column: 14 } },
      ],
    });

    const restored = new MaldivesWorkspace({ createModel, editor: editor as never });
    expect(restoreWorkspaceSnapshot(restored, snapshot)).toBe(true);
    expect(restored.uris()).toEqual(["file:///p16a3/app.tsx", "file:///p16a3/repo.ts"]);
    expect(restored.activeUri).toBe("file:///p16a3/app.tsx");
    expect(restored.isDirty("file:///p16a3/app.tsx")).toBe(false);
    expect(models.get("file:///p16a3/app.tsx")?.getValue()).toContain("readonly dirty = true");
    expect(editor.setPosition).toHaveBeenLastCalledWith({ lineNumber: 1, column: 7 });
  });

  test("persists to localStorage on workspace and cursor changes", () => {
    const storage = fakeStorage();
    const workspace = new MaldivesWorkspace({ createModel: (uri, content) => fakeModel(uri, content) as never });
    const cursorListeners = new Set<() => void>();
    const editor = {
      getPosition: () => ({ lineNumber: 2, column: 3 }),
      onDidChangeCursorPosition: (listener: () => void) => {
        cursorListeners.add(listener);
        return { dispose: () => cursorListeners.delete(listener) };
      },
    };

    workspace.open("file:///p16a3/app.tsx", "import { Effect } from \"effect\";\n");
    const subscription = installWorkspacePersistence({ workspace, editor: editor as never, storage, key: "p16a3" });
    for (const listener of cursorListeners) listener();

    expect(JSON.parse(storage.getItem("p16a3") ?? "{}")).toMatchObject({
      version: 1,
      activeUri: "file:///p16a3/app.tsx",
      files: [{ uri: "file:///p16a3/app.tsx", content: "import { Effect } from \"effect\";\n", cursor: { lineNumber: 2, column: 3 } }],
    });

    subscription.dispose();
    workspace.open("file:///p16a3/after-dispose.ts", "export const after = true;\n");
    expect(JSON.parse(storage.getItem("p16a3") ?? "{}").files).toHaveLength(1);
  });
});

function fakeModel(uri: string, initialContent: string): FakeModel {
  const listeners = new Set<() => void>();
  let content = initialContent;

  return {
    uri: { toString: () => uri },
    getValue: () => content,
    setValue(value) {
      content = value;
      for (const listener of listeners) listener();
    },
    onDidChangeContent(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    dispose: vi.fn(),
  };
}

function fakeStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
