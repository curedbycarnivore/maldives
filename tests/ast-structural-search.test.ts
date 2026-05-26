import type { Range as AstGrepRange } from "@ast-grep/wasm";
import type { editor } from "monaco-editor";
import { describe, expect, test } from "vitest";
import { astGrepRangeToModelRange, astGrepRangeToMonacoRange } from "../src/ast-structural-search";

function astRange(start: number, end: number): AstGrepRange {
  return {
    start: { index: start, line: 0, column: start },
    end: { index: end, line: 0, column: end },
  } as AstGrepRange;
}

function modelFor(source: string): editor.ITextModel {
  return {
    getPositionAt(offset: number) {
      const before = source.slice(0, offset);
      const lines = before.split("\n");

      return {
        lineNumber: lines.length,
        column: lines.at(-1)!.length + 1,
      };
    },
  } as editor.ITextModel;
}

describe("ast-grep range conversion", () => {
  test("converts ast-grep line and column ranges to Monaco ranges", () => {
    expect(
      astGrepRangeToMonacoRange({
        start: { index: 2, line: 1, column: 4 },
        end: { index: 8, line: 1, column: 10 },
      } as AstGrepRange),
    ).toEqual({
      startLineNumber: 2,
      startColumn: 5,
      endLineNumber: 2,
      endColumn: 11,
    });
  });

  test("uses model offsets so multiline Monaco ranges account for model EOLs", () => {
    expect(astGrepRangeToModelRange(astRange(4, 12), modelFor("one\ntwo three"))).toEqual({
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      endColumn: 9,
    });
  });

  test("filters zero-width and invalid matches", () => {
    const model = modelFor("alpha");
    const ranges = [astRange(0, 5), astRange(2, 2), astRange(4, 1)]
      .map((range) => astGrepRangeToModelRange(range, model))
      .filter((range) => range !== undefined);

    expect(ranges).toEqual([{ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 }]);
  });
});
