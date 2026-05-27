import { describe, expect, test, vi } from "vitest";
import { fileSwitcherItems, registerModelTab, switchToModelTab } from "../src/file-switcher";

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

  test("switches registered model tabs by deterministic one-based index", () => {
    const disposedModel = { uri: { path: "/maldives/disposed.ts" }, isDisposed: () => true };
    const firstModel = { uri: { path: "/maldives/first.ts" }, isDisposed: () => false };
    const secondModel = { uri: { path: "/maldives/second.ts" }, isDisposed: () => false };
    const setModel = vi.fn();
    const focus = vi.fn();
    const editor = { getModel: () => firstModel, setModel, focus };

    registerModelTab(disposedModel as never);
    registerModelTab(firstModel as never);
    registerModelTab(secondModel as never);

    expect(switchToModelTab(editor as never, 2)).toBe(true);
    expect(setModel).toHaveBeenCalledWith(secondModel);
    expect(focus).toHaveBeenCalledTimes(1);

    expect(switchToModelTab(editor as never, 10)).toBe(false);
    expect(setModel).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(2);
  });
});
