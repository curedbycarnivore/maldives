import { describe, expect, test } from "vitest";
import { fileSwitcherItems } from "../src/file-switcher";

describe("fileSwitcherItems", () => {
  test("returns a deterministic entry for the current sample TypeScript model", () => {
    const model = { uri: { path: "/maldives/sample.ts" } };
    const editor = { getModel: () => model };

    expect(fileSwitcherItems(editor as never)).toEqual([
      {
        label: "sample.ts",
        description: "/maldives/sample.ts",
        model,
      },
    ]);
  });
});
