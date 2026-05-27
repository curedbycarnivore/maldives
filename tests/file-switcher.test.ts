import { describe, expect, test, vi } from "vitest";
import {
  fileSwitcherItems,
  moveCurrentModelTabRight,
  recentLocationItems,
  recordCurrentRecentLocation,
  registerModelTab,
  selectRecentLocation,
  switchToModelTab,
} from "../src/file-switcher";

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

  test("moves the current model tab one live slot to the right", () => {
    const firstModel = fakeModel("/maldives/move-first.ts", ["const first = 1;"]);
    const secondModel = fakeModel("/maldives/move-second.ts", ["const second = 2;"]);
    const thirdModel = fakeModel("/maldives/move-third.ts", ["const third = 3;"]);
    let currentModel = firstModel;
    const focus = vi.fn();
    const editor = {
      getModel: () => currentModel,
      focus,
    };

    registerModelTab(firstModel as never);
    registerModelTab(secondModel as never);
    registerModelTab(thirdModel as never);

    expect(moveCurrentModelTabRight(editor as never)).toBe(true);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(fileSwitcherItems(editor as never).filter((item) => item.model === firstModel || item.model === secondModel || item.model === thirdModel)).toEqual([
      expect.objectContaining({ model: secondModel }),
      expect.objectContaining({ model: firstModel }),
      expect.objectContaining({ model: thirdModel }),
    ]);

    currentModel = thirdModel;
    expect(moveCurrentModelTabRight(editor as never)).toBe(false);
    expect(focus).toHaveBeenCalledTimes(2);
    expect(fileSwitcherItems(editor as never).filter((item) => item.model === firstModel || item.model === secondModel || item.model === thirdModel)).toEqual([
      expect.objectContaining({ model: secondModel }),
      expect.objectContaining({ model: firstModel }),
      expect.objectContaining({ model: thirdModel }),
    ]);
  });

  test("tracks recent locations newest-first while de-duping exact positions", () => {
    const firstModel = fakeModel("/maldives/first.ts", ["const first = 1;", "const repeated = first;"]);
    const secondModel = fakeModel("/maldives/second.ts", ["const second = 2;"]);
    let model = firstModel;
    let position = { lineNumber: 1, column: 7 };
    const editor = {
      getModel: () => model,
      getPosition: () => position,
    };

    recordCurrentRecentLocation(editor as never);
    position = { lineNumber: 2, column: 13 };
    recordCurrentRecentLocation(editor as never);
    model = secondModel;
    position = { lineNumber: 1, column: 7 };
    recordCurrentRecentLocation(editor as never);
    model = firstModel;
    position = { lineNumber: 2, column: 13 };
    recordCurrentRecentLocation(editor as never);

    const locations = recentLocationItems().filter((item) => item.model === firstModel || item.model === secondModel);

    expect(locations.map(({ description, lineNumber, column }) => [description, lineNumber, column])).toEqual([
      ["/maldives/first.ts:2:13", 2, 13],
      ["/maldives/second.ts:1:7", 1, 7],
      ["/maldives/first.ts:1:7", 1, 7],
    ]);
  });

  test("selects a recent location by restoring its model and position", () => {
    const model = fakeModel("/maldives/selected.ts", ["const selected = true;"]);
    const setModel = vi.fn();
    const setPosition = vi.fn();
    const focus = vi.fn();

    expect(
      selectRecentLocation(
        { setModel, setPosition, focus } as never,
        {
          label: "const selected = true;",
          description: "/maldives/selected.ts:1:8",
          model: model as never,
          lineNumber: 1,
          column: 8,
        },
      ),
    ).toBe(true);

    expect(setModel).toHaveBeenCalledWith(model);
    expect(setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 8 });
    expect(focus).toHaveBeenCalledTimes(1);
  });
});

function fakeModel(path: string, lines: string[]): {
  uri: { path: string; toString: () => string };
  isDisposed: () => boolean;
  getLineContent: (lineNumber: number) => string;
} {
  return {
    uri: { path, toString: () => `file://${path}` },
    isDisposed: () => false,
    getLineContent: (lineNumber) => lines[lineNumber - 1] ?? "",
  };
}
