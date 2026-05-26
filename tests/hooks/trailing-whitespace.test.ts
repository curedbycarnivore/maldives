import { describe, expect, test } from "vitest";
import { cleanOnBlur, ensureFinalNewline, removeTrailingBlankLines } from "../../src/hooks/trailing-whitespace";

const cleanupOptions = {
  removeTrailingBlankLines: true,
  trimAutoWhitespace: true,
  insertFinalNewline: true,
};

describe("trailing whitespace blur cleanup", () => {
  test("removes trailing blank lines", () => {
    expect(removeTrailingBlankLines("alpha\n\n")).toBe("alpha");
    expect(removeTrailingBlankLines("alpha\n\t  \n  ")).toBe("alpha");
  });

  test("ensures a final newline", () => {
    expect(ensureFinalNewline("alpha")).toBe("alpha\n");
    expect(ensureFinalNewline("alpha\n")).toBe("alpha\n");
  });

  test("removes trailing blank lines before ensuring one EOF newline", () => {
    expect(cleanOnBlur("alpha   \n\n  \n", cleanupOptions)).toBe("alpha\n");
  });
});
