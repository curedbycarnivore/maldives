import { initializeTreeSitter, parse, registerDynamicLanguage } from "@ast-grep/wasm";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import {
  elementMoveForCursor,
  methodNavigationTargetForCursor,
  methodNavigationTargets,
  nextLargerNode,
  nodeAtOffset,
  statementMoveForCursor,
} from "../src/ast-smart-selection";

const typescriptWasmPath = resolve("node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm");

beforeAll(async () => {
  await initializeTreeSitter();
  await registerDynamicLanguage({
    typescript: { libraryPath: typescriptWasmPath },
  });
});

describe("nodeAtOffset", () => {
  test("finds the identifier under the cursor inside a call argument", () => {
    const root = parse("typescript", "add(alpha, beta)").root();
    const node = nodeAtOffset(root, 4);

    expect(node.kind()).toBe("identifier");
    expect(node.text()).toBe("alpha");
  });

  test("treats node ranges as end-exclusive", () => {
    const root = parse("typescript", "add(alpha, beta)").root();
    const node = nodeAtOffset(root, 9);

    expect(node.text()).toBe(",");
  });
});

describe("nextLargerNode", () => {
  test("expands from an identifier selection to the enclosing arguments", () => {
    const root = parse("typescript", "add(alpha, beta)").root();
    const expanded = nextLargerNode(nodeAtOffset(root, 9), 4, 9);

    expect(expanded?.kind()).toBe("arguments");
    expect(expanded?.text()).toBe("(alpha, beta)");
  });

  test("expands from arguments to the call expression", () => {
    const root = parse("typescript", "add(alpha, beta)").root();
    const expanded = nextLargerNode(nodeAtOffset(root, 3), 3, 16);

    expect(expanded?.kind()).toBe("call_expression");
    expect(expanded?.text()).toBe("add(alpha, beta)");
  });
});

function applyEdit(source: string, edit: NonNullable<ReturnType<typeof elementMoveForCursor>>): string {
  return source.slice(0, edit.startOffset) + edit.text + source.slice(edit.endOffset);
}

describe("statementMoveForCursor", () => {
  const source = "function demo() {\n  const first = 1;\n  const second = 2;\n}\n";

  test("moves the current statement down across its adjacent sibling", () => {
    const edit = statementMoveForCursor(source, source.indexOf("first"), "down");

    expect(edit).toBeDefined();
    expect(source.slice(0, edit!.startOffset) + edit!.text + source.slice(edit!.endOffset)).toBe(
      "function demo() {\n  const second = 2;\n  const first = 1;\n}\n",
    );
  });

  test("moves the current statement up across its adjacent sibling", () => {
    const edit = statementMoveForCursor(source, source.indexOf("second"), "up");

    expect(edit).toBeDefined();
    expect(source.slice(0, edit!.startOffset) + edit!.text + source.slice(edit!.endOffset)).toBe(
      "function demo() {\n  const second = 2;\n  const first = 1;\n}\n",
    );
  });

  test("does not move past statement boundaries", () => {
    expect(statementMoveForCursor(source, source.indexOf("first"), "up")).toBeUndefined();
    expect(statementMoveForCursor(source, source.indexOf("second"), "down")).toBeUndefined();
  });
});

describe("methodNavigationTargetForCursor", () => {
  const source = [
    "function topLevel() {}",
    "const arrow = () => {};",
    "class Demo {",
    "  first() {}",
    "  second = () => {};",
    "}",
    "interface Contract {",
    "  run(): void;",
    "}",
  ].join("\n");

  test("finds function-like and method-like declarations in source order", () => {
    expect(methodNavigationTargets(source)).toEqual([
      source.indexOf("function topLevel"),
      source.indexOf("const arrow"),
      source.indexOf("first"),
      source.indexOf("second"),
      source.indexOf("run"),
    ]);
  });

  test("moves to the next and previous method target around the cursor", () => {
    expect(methodNavigationTargetForCursor(source, source.indexOf("topLevel"), "down")).toBe(
      source.indexOf("const arrow"),
    );
    expect(methodNavigationTargetForCursor(source, source.indexOf("second"), "up")).toBe(source.indexOf("first"));
  });
});

describe("elementMoveForCursor", () => {
  test("moves function call arguments left and right", () => {
    const source = "call(first, second, third);";

    const left = elementMoveForCursor(source, source.indexOf("second"), "left");
    const right = elementMoveForCursor(source, source.indexOf("second"), "right");

    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(applyEdit(source, left!)).toBe("call(second, first, third);");
    expect(applyEdit(source, right!)).toBe("call(first, third, second);");
  });

  test("moves array elements left and right", () => {
    const source = "const values = [first, second, third];";

    const left = elementMoveForCursor(source, source.indexOf("second"), "left");
    const right = elementMoveForCursor(source, source.indexOf("second"), "right");

    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(applyEdit(source, left!)).toBe("const values = [second, first, third];");
    expect(applyEdit(source, right!)).toBe("const values = [first, third, second];");
  });

  test("moves object properties left and right", () => {
    const source = "const value = { first: 1, second: 2, third: 3 };";

    const left = elementMoveForCursor(source, source.indexOf("second"), "left");
    const right = elementMoveForCursor(source, source.indexOf("second"), "right");

    expect(left).toBeDefined();
    expect(right).toBeDefined();
    expect(applyEdit(source, left!)).toBe("const value = { second: 2, first: 1, third: 3 };");
    expect(applyEdit(source, right!)).toBe("const value = { first: 1, third: 3, second: 2 };");
  });

  test("does not move past element boundaries", () => {
    const source = "call(first, second);";

    expect(elementMoveForCursor(source, source.indexOf("first"), "left")).toBeUndefined();
    expect(elementMoveForCursor(source, source.indexOf("second"), "right")).toBeUndefined();
  });
});
