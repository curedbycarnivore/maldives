import type { editor } from "monaco-editor";

type MonacoApi = typeof import("monaco-editor");

export const stripTrailingWhitespace = (value: string): string =>
  value.replace(/[\t ]+(?=\r?\n|$)/g, "");

export const removeTrailingBlankLines = (value: string): string =>
  value.replace(/(?:\r?\n[\t ]*)+$/g, "");

export const ensureFinalNewline = (value: string): string =>
  value && !value.endsWith("\n") ? `${value}\n` : value;

export const cleanOnBlur = (
  value: string,
  options: {
    removeTrailingBlankLines: boolean;
    trimAutoWhitespace: boolean;
    insertFinalNewline: boolean;
  },
): string => {
  let next = value;

  if (options.removeTrailingBlankLines) {
    next = removeTrailingBlankLines(next);
  }

  if (options.trimAutoWhitespace) {
    next = stripTrailingWhitespace(next);
  }

  if (options.insertFinalNewline) {
    next = ensureFinalNewline(next);
  }

  return next;
};

export const cleanOnBlurFromModel = (
  model: editor.ITextModel,
  options: Parameters<typeof cleanOnBlur>[1],
): void => {
  const value = model.getValue();
  const next = cleanOnBlur(value, options);

  if (next !== value) {
    model.pushEditOperations([], [{ range: model.getFullModelRange(), text: next }], () => null);
  }
};

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
