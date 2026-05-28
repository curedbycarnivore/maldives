import { describe, expect, test } from "vitest";
import { buildCodeNavigationContent, symbolNameAtOffset, type NavigationNode } from "../src/code-navigation";

describe("code navigation overlay content", () => {
  test("explains unsupported super-method navigation with the current TypeScript symbol", () => {
    const content = buildCodeNavigationContent("gotoSuperMethod", "parse");

    expect(content.title).toBe("Goto Super Method");
    expect(content.primary).toContain("parse");
    expect(content.detail).toContain("Standalone Monaco");
  });

  test("explains unsupported test navigation without returning an empty/no-op message", () => {
    const content = buildCodeNavigationContent("gotoTest", undefined);

    expect(content.title).toBe("Goto Test");
    expect(content.primary).not.toHaveLength(0);
    expect(content.detail).toContain("test index");
  });

  test("finds the deepest TypeScript navigation-tree symbol at an offset", () => {
    const tree: NavigationNode = {
      text: "sample.ts",
      spans: [{ start: 0, length: 100 }],
      childItems: [
        {
          text: "XMLParser",
          spans: [{ start: 10, length: 40 }],
          childItems: [{ text: "parse", spans: [{ start: 24, length: 12 }] }],
        },
      ],
    };

    expect(symbolNameAtOffset(tree, 28)).toBe("parse");
  });
});
