export interface EditorBehaviorConfig {
  trimAutoWhitespace: boolean;
  insertFinalNewline: boolean;
  removeTrailingBlankLines: boolean;
}

export function parseEditorOptions(xmlContent: string): EditorBehaviorConfig {
  return {
    trimAutoWhitespace: optionValue(xmlContent, "STRIP_TRAILING_SPACES") === "Whole",
    insertFinalNewline: optionValue(xmlContent, "IS_ENSURE_NEWLINE_AT_EOF") === "true",
    removeTrailingBlankLines: optionValue(xmlContent, "REMOVE_TRAILING_BLANK_LINES") === "true",
  };
}

function optionValue(xmlContent: string, name: string): string {
  return xmlContent.match(new RegExp(`<option name="${escapeRegExp(name)}" value="([^"]*)" \/>`))?.[1] ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
