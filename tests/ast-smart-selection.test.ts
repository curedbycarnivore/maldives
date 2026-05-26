import { initializeTreeSitter, parse, registerDynamicLanguage } from "@ast-grep/wasm";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { nextLargerNode, nodeAtOffset } from "../src/ast-smart-selection";

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
