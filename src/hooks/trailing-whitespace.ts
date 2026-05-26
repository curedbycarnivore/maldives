import type { editor } from "monaco-editor";

type MonacoApi = typeof import("monaco-editor");

export const stripTrailingWhitespace = (value: string): string =>
  value.replace(/[\t ]+(?=\r?\n|$)/g, "");

export const stripTrailingWhitespaceFromModel = (
  monacoApi: MonacoApi,
  model: editor.ITextModel,
): void => {
  const edits: editor.IIdentifiedSingleEditOperation[] = [];

  for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber += 1) {
    const line = model.getLineContent(lineNumber);
    const stripped = stripTrailingWhitespace(line);

    if (stripped.length !== line.length) {
      edits.push({
        range: new monacoApi.Range(lineNumber, stripped.length + 1, lineNumber, line.length + 1),
        text: "",
      });
    }
  }

  if (edits.length > 0) {
    model.pushEditOperations([], edits, () => null);
  }
};
