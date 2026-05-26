import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseEditorOptions } from "../../src/parsers/editor-options-parser";

const editorOptions = parseEditorOptions(readFileSync("ssot/options/editor.xml", "utf-8"));

test("parses editor behavior options", () => {
  expect(editorOptions.trimAutoWhitespace).toBe(true);
  expect(editorOptions.insertFinalNewline).toBe(true);
  expect(editorOptions.removeTrailingBlankLines).toBe(true);
});
