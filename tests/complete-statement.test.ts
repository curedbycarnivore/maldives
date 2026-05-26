import { initializeTreeSitter, registerDynamicLanguage } from "@ast-grep/wasm";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { completionForCursor } from "../src/ast-smart-selection";

const typescriptWasmPath = resolve("node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm");

beforeAll(async () => {
  await initializeTreeSitter();
  await registerDynamicLanguage({
    typescript: { libraryPath: typescriptWasmPath },
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
