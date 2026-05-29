import { initializeTreeSitter, parse, registerDynamicLanguage, type SgNode } from "@ast-grep/wasm";
import type { editor } from "monaco-editor";

const TYPESCRIPT_LANGUAGE = "typescript";
export const COMPLETE_STATEMENT_READY_TIMEOUT_MS = 50;
let initPromise: Promise<void> | undefined;

export function initializeAstSmartSelection(): Promise<void> {
  initPromise ??= initializeTreeSitter().then(() =>
    registerDynamicLanguage({
      [TYPESCRIPT_LANGUAGE]: { libraryPath: "/ast/tree-sitter-typescript.wasm" },
    }),
  );

  return initPromise;
}

export function ensureAstReady(): Promise<void> {
  return initializeAstSmartSelection();
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

interface StructuralMoveEdit {
  startOffset: number;
  endOffset: number;
  text: string;
  cursorOffset: number;
}

export function completeStatementWhenReady(
  editor: editor.IStandaloneCodeEditor,
  astReady?: Promise<void>,
  options?: { ignoreWidgetFocus?: boolean },
): void {
  const hasBlockingWidgetFocus = () => !options?.ignoreWidgetFocus && editor.hasWidgetFocus();

  if (hasBlockingWidgetFocus()) {
    return;
  }

  if (!astReady && completeStatement(editor)) {
    return;
  }

  const ready = astReady ?? initializeAstSmartSelection();
  let handled = false;
  let timeoutId: ReturnType<typeof globalThis.setTimeout>;
  const fallback = () => {
    if (handled) {
      return;
    }

    handled = true;
    if (!hasBlockingWidgetFocus()) {
      completeStatementFallback(editor);
    }
  };
  const tryCompleteStatement = () => {
    if (handled) {
      return;
    }

    globalThis.clearTimeout(timeoutId);
    if (hasBlockingWidgetFocus() || completeStatement(editor)) {
      handled = true;
      return;
    }

    fallback();
  };

  timeoutId = globalThis.setTimeout(fallback, COMPLETE_STATEMENT_READY_TIMEOUT_MS);
  void ready.then(tryCompleteStatement, () => {
    globalThis.clearTimeout(timeoutId);
    fallback();
  });
}

export function moveStatementWhenReady(editor: editor.IStandaloneCodeEditor, direction: "up" | "down"): void {
  if (!initPromise) {
    initPromise = initializeAstSmartSelection();
  }

  void initPromise.then(
    () => moveStatement(editor, direction),
    () => undefined,
  );
}

export function moveElementWhenReady(editor: editor.IStandaloneCodeEditor, direction: "left" | "right"): void {
  if (!initPromise) {
    initPromise = initializeAstSmartSelection();
  }

  void initPromise.then(
    () => moveElement(editor, direction),
    () => undefined,
  );
}

export function navigateMethodWhenReady(editor: editor.IStandaloneCodeEditor, direction: "up" | "down"): void {
  if (!initPromise) {
    initPromise = initializeAstSmartSelection();
  }

  void initPromise.then(
    () => navigateMethod(editor, direction),
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

function completeStatementFallback(editor: editor.IStandaloneCodeEditor): boolean {
  const model = editor.getModel();
  const position = editor.getPosition();

  if (!model || !position) {
    return false;
  }

  const lineEndColumn = model.getLineMaxColumn(position.lineNumber);
  editor.executeEdits("maldives", [
    {
      range: {
        startLineNumber: position.lineNumber,
        startColumn: lineEndColumn,
        endLineNumber: position.lineNumber,
        endColumn: lineEndColumn,
      },
      text: ";\n",
    },
  ]);
  editor.setPosition({ lineNumber: position.lineNumber + 1, column: 1 });
  return true;
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

function moveStatement(editor: editor.IStandaloneCodeEditor, direction: "up" | "down"): boolean {
  const model = editor.getModel();
  const selection = editor.getSelection();

  if (!model || !selection || model.getLanguageId() !== TYPESCRIPT_LANGUAGE) {
    return false;
  }

  const edit = statementMoveForCursor(model.getValue(), model.getOffsetAt(selection.getPosition()), direction);

  return applyStructuralMove(editor, edit);
}

function moveElement(editor: editor.IStandaloneCodeEditor, direction: "left" | "right"): boolean {
  const model = editor.getModel();
  const selection = editor.getSelection();

  if (!model || !selection || model.getLanguageId() !== TYPESCRIPT_LANGUAGE) {
    return false;
  }

  const edit = elementMoveForCursor(model.getValue(), model.getOffsetAt(selection.getPosition()), direction);

  return applyStructuralMove(editor, edit);
}

function navigateMethod(editor: editor.IStandaloneCodeEditor, direction: "up" | "down"): boolean {
  const model = editor.getModel();
  const selection = editor.getSelection();

  if (!model || !selection || model.getLanguageId() !== TYPESCRIPT_LANGUAGE) {
    return false;
  }

  const target = methodNavigationTargetForCursor(model.getValue(), model.getOffsetAt(selection.getPosition()), direction);

  if (target === undefined) {
    return false;
  }

  editor.setPosition(model.getPositionAt(target));
  return true;
}

function applyStructuralMove(
  editor: editor.IStandaloneCodeEditor,
  edit: StructuralMoveEdit | undefined,
): boolean {
  const model = editor.getModel();

  if (!model || !edit) {
    return false;
  }

  const start = model.getPositionAt(edit.startOffset);
  const end = model.getPositionAt(edit.endOffset);
  editor.executeEdits("maldives", [
    {
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      },
      text: edit.text,
    },
  ]);
  editor.setPosition(model.getPositionAt(edit.cursorOffset));
  return true;
}

export function statementMoveForCursor(
  source: string,
  offset: number,
  direction: "up" | "down",
): StructuralMoveEdit | undefined {
  try {
    const statement = movableStatementAt(nodeAtOffset(parse(TYPESCRIPT_LANGUAGE, source).root(), offset));
    const parent = statement?.parent_node();

    if (!statement || !parent) {
      return undefined;
    }

    const siblings = parent.children_nodes().filter(isMovableStatement);
    const statementRange = statement.range();
    const index = siblings.findIndex((sibling) => sameRange(sibling, statementRange.start.index, statementRange.end.index));
    const target = siblings[index + (direction === "up" ? -1 : 1)];

    if (!target) {
      return undefined;
    }

    return swapAdjacentStatements(source, statement, target);
  } catch {
    return undefined;
  }
}

export function elementMoveForCursor(
  source: string,
  offset: number,
  direction: "left" | "right",
): StructuralMoveEdit | undefined {
  try {
    const element = movableElementAt(nodeAtOffset(parse(TYPESCRIPT_LANGUAGE, source).root(), offset));
    const parent = element?.parent_node();

    if (!element || !parent) {
      return undefined;
    }

    const siblings = movableElementSiblings(parent);
    const elementRange = element.range();
    const index = siblings.findIndex((sibling) => sameRange(sibling, elementRange.start.index, elementRange.end.index));
    const target = siblings[index + (direction === "left" ? -1 : 1)];

    if (!target) {
      return undefined;
    }

    return swapAdjacentNodes(source, element, target);
  } catch {
    return undefined;
  }
}

export function methodNavigationTargets(source: string): number[] {
  try {
    const targets: number[] = [];

    collectMethodNavigationTargets(parse(TYPESCRIPT_LANGUAGE, source).root(), targets);
    return targets.sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function methodNavigationTargetForCursor(
  source: string,
  offset: number,
  direction: "up" | "down",
): number | undefined {
  const targets = methodNavigationTargets(source);

  if (direction === "down") {
    return targets.find((target) => target > offset);
  }

  for (let index = targets.length - 1; index >= 0; index -= 1) {
    if (targets[index] < offset) {
      return targets[index];
    }
  }

  return undefined;
}

function collectMethodNavigationTargets(node: SgNode, targets: number[]): void {
  if (isMethodNavigationNode(node)) {
    targets.push(node.range().start.index);
    return;
  }

  for (const child of node.children_nodes()) {
    collectMethodNavigationTargets(child, targets);
  }
}

function isMethodNavigationNode(node: SgNode): boolean {
  const kind = node.kind();

  return (
    METHOD_NAVIGATION_KINDS.has(kind) ||
    ((kind === "lexical_declaration" || kind === "public_field_definition") && hasDescendantKind(node, "arrow_function"))
  );
}

function hasDescendantKind(node: SgNode, kind: string): boolean {
  return node.children_nodes().some((child) => child.kind() === kind || hasDescendantKind(child, kind));
}

function swapAdjacentStatements(source: string, statement: SgNode, target: SgNode): StructuralMoveEdit | undefined {
  const statementRange = statement.range();
  const targetRange = target.range();
  const first = statementRange.start.index < targetRange.start.index ? statementRange : targetRange;
  const second = first === statementRange ? targetRange : statementRange;

  if (first.end.index > second.start.index) {
    return undefined;
  }

  const firstText = source.slice(first.start.index, first.end.index);
  const betweenText = source.slice(first.end.index, second.start.index);
  const secondText = source.slice(second.start.index, second.end.index);
  const statementIsFirst = first === statementRange;

  return {
    startOffset: first.start.index,
    endOffset: second.end.index,
    text: secondText + betweenText + firstText,
    cursorOffset: statementIsFirst ? first.start.index + secondText.length + betweenText.length : first.start.index,
  };
}

function swapAdjacentNodes(source: string, node: SgNode, target: SgNode): StructuralMoveEdit | undefined {
  const nodeRange = node.range();
  const targetRange = target.range();
  const first = nodeRange.start.index < targetRange.start.index ? nodeRange : targetRange;
  const second = first === nodeRange ? targetRange : nodeRange;

  if (first.end.index > second.start.index) {
    return undefined;
  }

  const firstText = source.slice(first.start.index, first.end.index);
  const betweenText = source.slice(first.end.index, second.start.index);
  const secondText = source.slice(second.start.index, second.end.index);
  const nodeIsFirst = first === nodeRange;

  return {
    startOffset: first.start.index,
    endOffset: second.end.index,
    text: secondText + betweenText + firstText,
    cursorOffset: nodeIsFirst ? first.start.index + secondText.length + betweenText.length : first.start.index,
  };
}

function movableStatementAt(node: SgNode): SgNode | undefined {
  let current: SgNode | undefined = node;

  while (current) {
    if (isMovableStatement(current)) {
      return current;
    }

    current = current.parent_node();
  }

  return undefined;
}

function isMovableStatement(node: SgNode): boolean {
  return MOVABLE_STATEMENT_KINDS.has(node.kind());
}

function movableElementAt(node: SgNode): SgNode | undefined {
  let current: SgNode | undefined = node;

  while (current) {
    const candidate: SgNode = current;
    const parent: SgNode | undefined = candidate.parent_node();

    if (parent && movableElementSiblings(parent).some((sibling) => sameRangeNode(sibling, candidate))) {
      return candidate;
    }

    current = parent;
  }

  return undefined;
}

function movableElementSiblings(parent: SgNode): SgNode[] {
  if (parent.kind() === "arguments" || parent.kind() === "array") {
    return parent.children_nodes().filter((child) => !ELEMENT_DELIMITER_KINDS.has(child.kind()) && child.kind() !== "comment");
  }

  if (parent.kind() === "object") {
    return parent.children_nodes().filter((child) => child.kind() === "pair");
  }

  return [];
}

function sameRangeNode(a: SgNode, b: SgNode): boolean {
  const range = b.range();

  return sameRange(a, range.start.index, range.end.index);
}

function sameRange(node: SgNode, startOffset: number, endOffset: number): boolean {
  const range = node.range();

  return range.start.index === startOffset && range.end.index === endOffset;
}

const ELEMENT_DELIMITER_KINDS = new Set(["(", ")", "[", "]", ","]);

const METHOD_NAVIGATION_KINDS = new Set([
  "abstract_method_signature",
  "function_declaration",
  "generator_function_declaration",
  "method_definition",
  "method_signature",
]);

const MOVABLE_STATEMENT_KINDS = new Set([
  "break_statement",
  "class_declaration",
  "continue_statement",
  "do_statement",
  "export_statement",
  "expression_statement",
  "for_in_statement",
  "for_statement",
  "function_declaration",
  "if_statement",
  "import_statement",
  "interface_declaration",
  "lexical_declaration",
  "return_statement",
  "switch_statement",
  "throw_statement",
  "try_statement",
  "type_alias_declaration",
  "variable_declaration",
  "while_statement",
]);

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
