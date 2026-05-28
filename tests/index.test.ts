import { describe, expect, test, vi } from "vitest";
import type * as monaco from "monaco-editor";

const monacoStub = vi.hoisted(() => {
  const state = {
    definedThemes: [] as Array<{ name: string; data: monaco.editor.IStandaloneThemeData }>,
    createdEditors: [] as Array<monaco.editor.IStandaloneEditorConstructionOptions>,
    snippetDisposed: false,
    editorDisposed: false,
    blurDisposed: false,
  };

  const editor = {
    addAction: vi.fn(() => ({ dispose: vi.fn() })),
    addCommand: vi.fn(() => "command-id"),
    createDecorationsCollection: vi.fn(() => ({ clear: vi.fn() })),
    getAction: vi.fn(() => ({ run: vi.fn() })),
    trigger: vi.fn(),
    getModel: vi.fn(() => null),
    getPosition: vi.fn(() => ({ lineNumber: 1, column: 1 })),
    onDidChangeCursorPosition: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeModel: vi.fn(() => ({ dispose: vi.fn() })),
    onDidBlurEditorText: vi.fn(() => ({
      dispose() {
        state.blurDisposed = true;
      },
    })),
    dispose() {
      state.editorDisposed = true;
    },
  };

  const api = {
    editor: {
      defineTheme(name: string, data: monaco.editor.IStandaloneThemeData) {
        state.definedThemes.push({ name, data });
      },
      create(_container: HTMLElement, options: monaco.editor.IStandaloneEditorConstructionOptions) {
        state.createdEditors.push(options);
        return editor;
      },
    },
    languages: {
      CompletionItemKind: { Snippet: 1 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      registerCompletionItemProvider: vi.fn(() => ({
        dispose() {
          state.snippetDisposed = true;
        },
      })),
      registerCodeActionProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    typescript: {
      ScriptTarget: { ESNext: 99 },
      ModuleKind: { ESNext: 99 },
      JsxEmit: { ReactJSX: 4 },
      typescriptDefaults: {
        setCompilerOptions: vi.fn(),
        setDiagnosticsOptions: vi.fn(),
        setInlayHintsOptions: vi.fn(),
        setEagerModelSync: vi.fn(),
        addExtraLib: vi.fn(() => ({ dispose: vi.fn() })),
      },
    },
    KeyMod: { CtrlCmd: 1, WinCtrl: 2, Shift: 4, Alt: 8 },
    KeyCode: new Proxy({}, { get: () => 16 }),
    Range: vi.fn(),
  };

  return { api, editor, state };
});

vi.mock("monaco-editor", () => monacoStub.api);

describe("createMaldivesEditor", () => {
  test("creates a themed Monaco editor and disposes owned resources", async () => {
    const { createMaldivesEditor } = await import("../src");
    const container = {} as HTMLElement;

    const result = createMaldivesEditor(container, { lspUrl: "ws://unused" });

    expect(result.editor).toBe(monacoStub.editor);
    expect(monacoStub.state.definedThemes[0]?.name).toBe("tomorrow-night-eighties");
    expect(monacoStub.state.createdEditors[0]).toMatchObject({
      language: "typescript",
      theme: "tomorrow-night-eighties",
      automaticLayout: true,
      trimAutoWhitespace: true,
      "semanticHighlighting.enabled": true,
      bracketPairColorization: { enabled: true },
      stickyScroll: { enabled: true },
      inlayHints: { enabled: "on" },
    });
    expect(monacoStub.editor.addCommand).toHaveBeenCalled();
    expect(monacoStub.api.languages.registerCompletionItemProvider).toHaveBeenCalledWith("typescript", expect.any(Object));
    expect(monacoStub.editor.onDidBlurEditorText).toHaveBeenCalledWith(expect.any(Function));

    result.dispose();

    expect(monacoStub.state.snippetDisposed).toBe(true);
    expect(monacoStub.state.blurDisposed).toBe(true);
    expect(monacoStub.state.editorDisposed).toBe(true);
  });
});
