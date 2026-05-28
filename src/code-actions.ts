import type * as monaco from "monaco-editor";

const providedCodeActionKinds = ["refactor.extract", "source.organizeImports"];

export function registerMaldivesCodeActions(monacoApi: typeof monaco): monaco.IDisposable {
  return monacoApi.languages.registerCodeActionProvider(
    "typescript",
    {
      provideCodeActions(model, range, context) {
        const actions = [extractSelectionAction(model, range), organizeImportsAction(model)].filter(
          (action): action is monaco.languages.CodeAction =>
            action !== undefined && matchesRequestedKind(action.kind ?? "", context.only),
        );

        return {
          actions,
          dispose() {},
        };
      },
    },
    { providedCodeActionKinds },
  );
}

function extractSelectionAction(
  model: monaco.editor.ITextModel,
  range: monaco.IRange,
): monaco.languages.CodeAction | undefined {
  const selectedText = model.getValueInRange(range);

  if (selectedText.trim().length === 0) {
    return undefined;
  }

  const indentation = model.getLineContent(range.startLineNumber).match(/^\s*/)?.[0] ?? "";
  const versionId = model.getVersionId();

  return {
    title: "Extract selection to const",
    kind: "refactor.extract",
    isPreferred: true,
    edit: {
      edits: [
        {
          resource: model.uri,
          versionId,
          textEdit: {
            range: {
              startLineNumber: range.startLineNumber,
              startColumn: 1,
              endLineNumber: range.startLineNumber,
              endColumn: 1,
            },
            text: `${indentation}const extracted = ${selectedText};\n`,
          },
        },
        {
          resource: model.uri,
          versionId,
          textEdit: { range, text: "extracted" },
        },
      ],
    },
  };
}

function organizeImportsAction(model: monaco.editor.ITextModel): monaco.languages.CodeAction {
  const importBlock = sortedImportBlock(model);

  return {
    title: "Sort imports",
    kind: "source.organizeImports",
    edit: { edits: importBlock ? [importBlock] : [] },
  };
}

function sortedImportBlock(model: monaco.editor.ITextModel): monaco.languages.IWorkspaceTextEdit | undefined {
  const importLines: string[] = [];
  let lineNumber = 1;

  while (lineNumber <= model.getLineCount()) {
    const line = model.getLineContent(lineNumber);

    if (!line.startsWith("import ")) {
      break;
    }

    importLines.push(line);
    lineNumber += 1;
  }

  if (importLines.length === 0) {
    return undefined;
  }

  const blankLineAfterImports = model.getLineContent(lineNumber) === "";
  const sortedText = `${[...importLines].sort().join("\n")}\n${blankLineAfterImports ? "\n" : ""}`;

  return {
    resource: model.uri,
    versionId: model.getVersionId(),
    textEdit: {
      range: {
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: blankLineAfterImports ? lineNumber + 1 : lineNumber,
        endColumn: 1,
      },
      text: sortedText,
    },
  };
}

function matchesRequestedKind(kind: string, requestedKind: string | undefined): boolean {
  return !requestedKind || kind === requestedKind || kind.startsWith(`${requestedKind}.`);
}
