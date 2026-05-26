import { parse, type Range as AstGrepRange } from "@ast-grep/wasm";
import type { editor, IRange, ISelection } from "monaco-editor";
import { initializeAstSmartSelection } from "./ast-smart-selection";

const TYPESCRIPT_LANGUAGE = "typescript";

export const AST_STRUCTURAL_SEARCH_ACTION_ID = "maldives.astGrepSearch";

type PatternProvider = () => Promise<string | undefined> | string | undefined;

export function astGrepRangeToMonacoRange(range: AstGrepRange): IRange | undefined {
  if (range.end.index <= range.start.index) {
    return undefined;
  }

  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.column + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.column + 1,
  };
}

export function astGrepRangeToModelRange(range: AstGrepRange, model: editor.ITextModel): IRange | undefined {
  if (range.end.index <= range.start.index) {
    return undefined;
  }

  const start = model.getPositionAt(range.start.index);
  const end = model.getPositionAt(range.end.index);

  return {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
}

function rangeToSelection(range: IRange): ISelection {
  return {
    selectionStartLineNumber: range.startLineNumber,
    selectionStartColumn: range.startColumn,
    positionLineNumber: range.endLineNumber,
    positionColumn: range.endColumn,
  };
}

export function registerAstStructuralSearchAction(
  editor: editor.IStandaloneCodeEditor,
  getPattern: PatternProvider = () => window.prompt("ast-grep pattern")?.trim(),
): { dispose(): void } {
  const decorations = editor.createDecorationsCollection();
  const action = editor.addAction({
    id: AST_STRUCTURAL_SEARCH_ACTION_ID,
    label: "AST Structural Search",
    run: async () => {
      await runAstStructuralSearch(editor, decorations, getPattern);
    },
  });

  return {
    dispose() {
      decorations.clear();
      action.dispose();
    },
  };
}

async function runAstStructuralSearch(
  editor: editor.IStandaloneCodeEditor,
  decorations: editor.IEditorDecorationsCollection,
  getPattern: PatternProvider,
): Promise<void> {
  const model = editor.getModel();

  if (!model || model.getLanguageId() !== TYPESCRIPT_LANGUAGE) {
    return;
  }

  const pattern = await getPattern();

  if (!pattern) {
    return;
  }

  try {
    await initializeAstSmartSelection();
    const ranges = parse(TYPESCRIPT_LANGUAGE, model.getValue())
      .root()
      .findAll(pattern)
      .map((node) => astGrepRangeToModelRange(node.range(), model))
      .filter((range): range is IRange => range !== undefined);

    if (ranges.length === 0) {
      decorations.clear();
      return;
    }

    editor.setSelections(ranges.map(rangeToSelection));
    decorations.set(
      ranges.map((range) => ({
        range,
        options: {
          className: "maldivesAstStructuralSearchMatch",
          overviewRuler: { color: "#ffcc00", position: 4 },
        },
      })),
    );
  } catch {
    decorations.clear();
  }
}
