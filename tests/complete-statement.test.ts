import { initializeTreeSitter, registerDynamicLanguage } from "@ast-grep/wasm";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  COMPLETE_STATEMENT_READY_TIMEOUT_MS,
  completeStatementWhenReady,
  completionForCursor,
} from "../src/ast-smart-selection";

const typescriptWasmPath = resolve("node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm");

interface CompleteStatementTestEdit {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  text?: string | null;
}

beforeAll(async () => {
  await initializeTreeSitter();
  await registerDynamicLanguage({
    typescript: { libraryPath: typescriptWasmPath },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("completeStatementWhenReady", () => {
  test("appends a semicolon and moves down when AST readiness times out", async () => {
    vi.useFakeTimers();
    const harness = createCompleteStatementEditor("const x = 1");

    completeStatementWhenReady(harness.editor, new Promise<void>(() => undefined));
    await vi.advanceTimersByTimeAsync(COMPLETE_STATEMENT_READY_TIMEOUT_MS);

    expect(harness.getValue()).toBe("const x = 1;\n");
    expect(harness.getPosition()).toEqual({ lineNumber: 2, column: 1 });
  });

  test("appends a semicolon and moves down when AST readiness rejects", async () => {
    const harness = createCompleteStatementEditor("const x = 1");

    completeStatementWhenReady(harness.editor, Promise.reject(new Error("AST unavailable")));
    await Promise.resolve();

    expect(harness.getValue()).toBe("const x = 1;\n");
    expect(harness.getPosition()).toEqual({ lineNumber: 2, column: 1 });
  });
});

describe("completionForCursor", () => {
  test("adds a missing semicolon", () => {
    const source = "const value = 1";

    expect(completionForCursor(source, source.length)).toEqual({
      insertOffset: source.length,
      text: ";",
      cursorOffset: source.length + 1,
    });
  });

  test("adds a missing call paren", () => {
    const source = "console.log(value";

    expect(completionForCursor(source, source.length)).toEqual({
      insertOffset: source.length,
      text: ")",
      cursorOffset: source.length + 1,
    });
  });

  test("expands an if condition into a block", () => {
    const source = "if (ready)";

    expect(completionForCursor(source, source.length)).toEqual({
      insertOffset: source.length,
      text: " {\n  \n}",
      cursorOffset: source.length + 5,
    });
  });
});

function createCompleteStatementEditor(source: string): {
  editor: Parameters<typeof completeStatementWhenReady>[0];
  getValue: () => string;
  getPosition: () => { lineNumber: number; column: number };
} {
  let value = source;
  let position = { lineNumber: 1, column: source.length + 1 };

  return {
    editor: {
      hasWidgetFocus: () => false,
      getModel: () => ({
        getLineMaxColumn: (_lineNumber: number) => value.length + 1,
      }),
      getPosition: () => position,
      executeEdits: (_source: string, edits: CompleteStatementTestEdit[]) => {
        const edit = edits[0];

        if (!edit) {
          return true;
        }

        const start = edit.range.startColumn - 1;
        const end = edit.range.endColumn - 1;
        value = value.slice(0, start) + (edit.text ?? "") + value.slice(end);
        return true;
      },
      setPosition: (next: { lineNumber: number; column: number }) => {
        position = next;
      },
    } as Parameters<typeof completeStatementWhenReady>[0],
    getValue: () => value,
    getPosition: () => position,
  };
}
