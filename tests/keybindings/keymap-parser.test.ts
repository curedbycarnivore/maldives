import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { parseKeymap } from "../../src/parsers/keymap-parser";

const keymap = parseKeymap(readFileSync("ssot/keymaps/leet hax.xml", "utf-8"));

function shortcutsFor(actionId: string): string[] {
  return keymap.actions.find((action) => action.id === actionId)?.shortcuts ?? [];
}

test("parses keymap metadata", () => {
  expect(keymap.name).toBe("leet hax");
  expect(keymap.parent).toBe("Mac OS X 10.5+");
});

test("parses keyboard shortcuts for actions", () => {
  expect(shortcutsFor("SelectNextOccurrence")).toContain("alt g");
  expect(shortcutsFor("EditorNextWordInDifferentHumpsMode")).toContain("meta alt right");
  expect(shortcutsFor("EditorPreviousWordInDifferentHumpsMode")).toContain("meta alt left");
});
