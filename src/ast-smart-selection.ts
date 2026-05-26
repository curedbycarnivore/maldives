import { initializeTreeSitter, parse, registerDynamicLanguage, type SgNode } from "@ast-grep/wasm";
import type { editor } from "monaco-editor";

const TYPESCRIPT_LANGUAGE = "typescript";
let initPromise: Promise<void> | undefined;

export function initializeAstSmartSelection(): Promise<void> {
  initPromise ??= initializeTreeSitter().then(() =>
    registerDynamicLanguage({
      [TYPESCRIPT_LANGUAGE]: { libraryPath: "/ast/tree-sitter-typescript.wasm" },
    }),
  );

  return initPromise;
}

export function expandAstSelection(editor: editor.IStandaloneCodeEditor): boolean {
  const model = editor.getModel();
  const selection = editor.getSelection();

  if (!model || !selection || model.getLanguageId() !== TYPESCRIPT_LANGUAGE) {
    return false;
  }

  try {
    const root = parse(TYPESCRIPT_LANGUAGE, model.getValue()).root();
    const cursorOffset = model.getOffsetAt(selection.getPosition());
    const currentStart = model.getOffsetAt(selection.getStartPosition());
    const currentEnd = model.getOffsetAt(selection.getEndPosition());
    const candidate = nextLargerNode(nodeAtOffset(root, cursorOffset), currentStart, currentEnd);

    if (!candidate) {
      return false;
    }

    const range = candidate.range();
    editor.setSelection({
      startLineNumber: range.start.line + 1,
      startColumn: range.start.column + 1,
      endLineNumber: range.end.line + 1,
      endColumn: range.end.column + 1,
    });
    return true;
  } catch {
    return false;
  }
}

export function expandAstSelectionWhenReady(
  editor: editor.IStandaloneCodeEditor,
  fallback: () => void,
): void {
  if (!initPromise) {
    void initializeAstSmartSelection().catch(() => undefined);
    fallback();
    return;
  }

  void initPromise.then(
    () => {
      if (!expandAstSelection(editor)) {
        fallback();
      }
    },
    fallback,
  );
}

interface CompleteStatementEdit {
  insertOffset: number;
  text: string;
  cursorOffset: number;
}

export function completeStatementWhenReady(editor: editor.IStandaloneCodeEditor): void {
  if (!initPromise) {
    initPromise = initializeAstSmartSelection();
  }

  void initPromise.then(
    () => completeStatement(editor),
    () => undefined,
  );
}

export function completionForCursor(source: string, offset: number): CompleteStatementEdit | undefined {
  const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextLineBreak = source.indexOf("\n", offset);
  const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
  const line = source.slice(lineStart, lineEnd);
  const trimmed = line.trim();

  if (!trimmed) {
    return undefined;
  }

  const indent = line.match(/^\s*/)?.[0] ?? "";
  const kind = kindAtOffset(source, offset);

  if ((kind === "if_statement" || trimmed.startsWith("if")) && /^\s*if\s*\([^)]*\)\s*$/.test(line)) {
    const text = ` {\n${indent}  \n${indent}}`;

    return { insertOffset: lineEnd, text, cursorOffset: lineEnd + 3 + indent.length + 2 };
  }

  if (/\b[\w.$]+\([^()]*\s*$/.test(line) && !line.includes("=>")) {
    return { insertOffset: lineEnd, text: ")", cursorOffset: lineEnd + 1 };
  }

  if (kind !== "if_statement" && !/[;{}:,]$/.test(trimmed)) {
    return { insertOffset: lineEnd, text: ";", cursorOffset: lineEnd + 1 };
  }

  return undefined;
}

function completeStatement(editor: editor.IStandaloneCodeEditor): boolean {
  const model = editor.getModel();
  const selection = editor.getSelection();

  if (!model || !selection || model.getLanguageId() !== TYPESCRIPT_LANGUAGE) {
    return false;
  }

  const edit = completionForCursor(model.getValue(), model.getOffsetAt(selection.getPosition()));

  if (!edit) {
    return false;
  }

  const position = model.getPositionAt(edit.insertOffset);
  editor.executeEdits("maldives", [
    {
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      text: edit.text,
    },
  ]);
  editor.setPosition(model.getPositionAt(edit.cursorOffset + eolOffsetBeforeCursor(model.getEOL(), edit)));
  return true;
}

function eolOffsetBeforeCursor(eol: string, edit: CompleteStatementEdit): number {
  const insertedCursorOffset = edit.cursorOffset - edit.insertOffset;

  return (eol.length - 1) * (edit.text.slice(0, insertedCursorOffset).split("\n").length - 1);
}

function kindAtOffset(source: string, offset: number): string | undefined {
  try {
    return nodeAtOffset(parse(TYPESCRIPT_LANGUAGE, source).root(), offset).kind();
  } catch {
    return undefined;
  }
}

export function nodeAtOffset(node: SgNode, offset: number): SgNode {
  for (const child of node.children_nodes()) {
    const range = child.range();

    if (range.start.index <= offset && offset < range.end.index) {
      return nodeAtOffset(child, offset);
    }
  }

  return node;
}

export function nextLargerNode(node: SgNode, startOffset: number, endOffset: number): SgNode | undefined {
  let current: SgNode | undefined = node;

  while (current) {
    const range = current.range();

    if (
      range.start.index <= startOffset &&
      endOffset <= range.end.index &&
      (range.start.index < startOffset || endOffset < range.end.index)
    ) {
      return current;
    }

    current = current.parent_node();
  }

  return undefined;
}
