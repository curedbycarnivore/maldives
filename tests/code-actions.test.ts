import { describe, expect, test, vi } from "vitest";
import { registerMaldivesCodeActions } from "../src/code-actions";

describe("registerMaldivesCodeActions", () => {
  test("provides a real extract-selection edit for IntroduceActionsGroup", () => {
    const registered = captureProvider();
    const range = { startLineNumber: 2, startColumn: 10, endLineNumber: 2, endColumn: 24 };
    const model = modelFor("function demo() {\n  return alpha + beta;\n}\n", "alpha + beta");

    const list = registered.provider.provideCodeActions(model, range, { only: "refactor", markers: [], trigger: 1 }, {});

    expect(list.actions[0]).toMatchObject({ title: "Extract selection to const", kind: "refactor.extract" });
    expect(list.actions[0]?.edit?.edits).toEqual([
      {
        resource: model.uri,
        versionId: 7,
        textEdit: {
          range: { startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1 },
          text: "  const extracted = alpha + beta;\n",
        },
      },
      {
        resource: model.uri,
        versionId: 7,
        textEdit: { range, text: "extracted" },
      },
    ]);
  });

  test("provides a source organize-imports edit that sorts imports", () => {
    const registered = captureProvider();
    const source = "import z from 'z';\nimport a from 'a';\n\nconst value = z + a;\n";
    const model = modelFor(source, "");

    const list = registered.provider.provideCodeActions(
      model,
      { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
      { only: "source.organizeImports", markers: [], trigger: 1 },
      {},
    );

    expect(list.actions[0]).toMatchObject({ title: "Sort imports", kind: "source.organizeImports" });
    expect(list.actions[0]?.edit?.edits).toEqual([
      {
        resource: model.uri,
        versionId: 7,
        textEdit: {
          range: { startLineNumber: 1, startColumn: 1, endLineNumber: 4, endColumn: 1 },
          text: "import a from 'a';\nimport z from 'z';\n\n",
        },
      },
    ]);
  });
});

function captureProvider() {
  const registered = {
    provider: undefined as unknown as {
      provideCodeActions: (model: ReturnType<typeof modelFor>, range: object, context: object, token: object) => { actions: unknown[]; dispose: () => void };
    },
  };
  const monacoApi = {
    languages: {
      registerCodeActionProvider: vi.fn((_language, provider) => {
        registered.provider = provider;
        return { dispose() {} };
      }),
    },
  };

  registerMaldivesCodeActions(monacoApi as never);

  return registered;
}

function modelFor(source: string, selectedText: string) {
  const lines = source.split("\n");

  return {
    uri: { toString: () => "file:///maldives/sample.ts" },
    getVersionId: () => 7,
    getValue: () => source,
    getValueInRange: () => selectedText,
    getLineCount: () => lines.length,
    getLineContent: (lineNumber: number) => lines[lineNumber - 1] ?? "",
  };
}
