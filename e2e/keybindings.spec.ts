import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __monaco: typeof import("monaco-editor");
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesTypeScriptReady: Promise<void>;
  }
}

async function loadEditor(page: Page): Promise<void> {
  await page.goto("http://127.0.0.1:5173/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);
}

async function waitForXmlParserSymbol(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const model = window.__maldivesEditor.getModel();

      if (!model) {
        return false;
      }

      try {
        const getWorker = await window.__monaco.languages.typescript.getTypeScriptWorker();
        const worker = await getWorker(model.uri);
        const tree = await worker.getNavigationTree(model.uri.toString());

        return JSON.stringify(tree).includes("XMLParser");
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 15000 },
  );
}

async function expectLineVisible(page: Page, lineNumber: number, visible: boolean): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (line) => {
          const visiblePosition = window.__maldivesEditor.getScrolledVisiblePosition({ lineNumber: line, column: 1 });

          return Boolean(visiblePosition && visiblePosition.height > 0);
        },
        lineNumber,
      ),
    )
    .toBe(visible);
}

test("unselect previous occurrence removes the last occurrence selection", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha alpha alpha alpha");
    window.__maldivesEditor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 });
    window.__maldivesExecuteKeybinding("SelectNextOccurrence");
    window.__maldivesExecuteKeybinding("SelectNextOccurrence");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getSelections()?.length ?? 0)).toBe(3);

  await page.evaluate(() => window.__maldivesExecuteKeybinding("UnselectPreviousOccurrence"));

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getSelections()?.length ?? 0)).toBe(2);
  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/unselect-occurrence.png" });
});

test("line navigation keybindings move and delete within the current line", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha beta gamma");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 8 });
    return window.__maldivesExecuteKeybinding("EditorLineStart");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(1);

  await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorLineEnd"));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column)).toBe(17);

  await page.evaluate(() => {
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 12 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToLineStart");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("gamma");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/line-nav-proof.png" });
});

test("editor move and scroll keybindings scroll without moving the cursor", async ({ page }) => {
  await loadEditor(page);

  const initial = await page.evaluate(() => {
    const editor = window.__maldivesEditor;

    editor.setValue(Array.from({ length: 200 }, (_, index) => `line ${index + 1}`).join("\n"));
    editor.setPosition({ lineNumber: 50, column: 3 });
    editor.setScrollTop(400);
    editor.focus();

    return {
      position: editor.getPosition(),
      scrollTop: editor.getScrollTop(),
      moved: window.__maldivesExecuteKeybinding("EditorMoveDownAndScroll"),
    };
  });

  expect(initial.moved).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getScrollTop())).toBeGreaterThan(initial.scrollTop);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition())).toEqual(initial.position);

  const afterDownScrollTop = await page.evaluate(() => window.__maldivesEditor.getScrollTop());
  const movedUp = await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorMoveUpAndScroll"));

  expect(movedUp).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getScrollTop())).toBeLessThan(afterDownScrollTop);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition())).toEqual(initial.position);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/editor-scroll-without-cursor-proof.png" });
});

test("file structure popup opens Monaco quick outline", async ({ page }) => {
  await loadEditor(page);
  await waitForXmlParserSymbol(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("FileStructurePopup"));

  expect(opened).toBe(true);
  await page.locator(".quick-input-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".quick-input-widget")).toContainText("XMLParser");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/file-structure-popup-proof.png" });
});

test("goto class opens Monaco quick outline", async ({ page }) => {
  await loadEditor(page);
  await waitForXmlParserSymbol(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("GotoClass"));

  expect(opened).toBe(true);
  await page.locator(".quick-input-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".quick-input-widget")).toContainText("XMLParser");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/goto-class-quick-outline-proof.png" });
});

test("search everywhere opens Monaco command palette", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("SearchEverywhere"));

  expect(opened).toBe(true);
  await page.locator(".quick-input-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".quick-input-widget input")).toHaveValue(">", { timeout: 8000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/search-everywhere-proof.png" });
});

test("replace actions open current-editor replace and replace-in-path placeholder", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => {
    window.__maldivesEditor.focus();

    return window.__maldivesExecuteKeybinding("Replace");
  });

  expect(opened).toBe(true);
  await page.locator(".find-widget.visible").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".find-widget.visible .replace-part")).toBeVisible({ timeout: 8000 });

  const placeholderOpened = await page.evaluate(() => window.__maldivesExecuteKeybinding("ReplaceInPath"));

  expect(placeholderOpened).toBe(true);
  await page.locator(".maldives-replace-in-path").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".maldives-replace-in-path")).toContainText("Replace in Path");
  await expect(page.locator(".maldives-replace-in-path")).toContainText("Multi-file replace is not available");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p6a-replace-proof.png" });
});

test("rename element opens Monaco inline rename input", async ({ page }) => {
  await loadEditor(page);
  await waitForXmlParserSymbol(page);

  const opened = await page.evaluate(() => {
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 8 });
    window.__maldivesEditor.focus();

    return window.__maldivesExecuteKeybinding("RenameElement");
  });

  expect(opened).toBe(true);
  await page.locator(".rename-box .rename-input").waitFor({ state: "visible", timeout: 8000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p5a-rename-element-proof.png" });
});

test("ace jump opens Monaco goto line quick input", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("AceJump"));

  expect(opened).toBe(true);
  await page.locator(".quick-input-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".quick-input-widget input")).toHaveValue(":", { timeout: 8000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p5c-acejump-proof.png" });
});

test("introduce actions and rearrange code keybindings execute Monaco equivalents", async ({ page }) => {
  await loadEditor(page);
  await waitForXmlParserSymbol(page);

  const rearranged = await page.evaluate(() => window.__maldivesExecuteKeybinding("RearrangeCode"));

  expect(rearranged).toBe(true);

  const opened = await page.evaluate(() => {
    window.__maldivesEditor.setSelection({ startLineNumber: 6, startColumn: 12, endLineNumber: 6, endColumn: 48 });
    window.__maldivesEditor.focus();

    return window.__maldivesExecuteKeybinding("IntroduceActionsGroup");
  });

  expect(opened).toBe(true);
  await page.locator(".action-widget").waitFor({ state: "visible", timeout: 8000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p4e-introduce-rearrange-proof.png" });
});

test("alt number tab keybindings switch deterministic models", async ({ page }) => {
  await loadEditor(page);

  const switchedToSecond = await page.evaluate(() => window.__maldivesExecuteKeybinding("GoToTab2"));

  expect(switchedToSecond).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.path)).toBe("/maldives/second.ts");

  const switchedToFirst = await page.evaluate(() => window.__maldivesExecuteKeybinding("GoToTab1"));

  expect(switchedToFirst).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.path)).toBe("/maldives/sample.ts");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.hasTextFocus())).toBe(true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/tab-switching-proof.png" });
});

test("move tab right reorders deterministic model tabs", async ({ page }) => {
  await loadEditor(page);

  const moved = await page.evaluate(() => window.__maldivesExecuteKeybinding("MoveTabRight"));

  expect(moved).toBe(true);

  const switchedToSecondSlot = await page.evaluate(() => window.__maldivesExecuteKeybinding("GoToTab2"));

  expect(switchedToSecondSlot).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.path)).toBe("/maldives/sample.ts");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.hasTextFocus())).toBe(true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/move-tab-right-proof.png" });
});

test("goto file opens the Maldives file switcher", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("GotoFile"));

  expect(opened).toBe(true);
  await page.locator(".maldives-file-switcher").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".maldives-file-switcher")).toContainText("Goto File");
  await expect(page.locator(".maldives-file-switcher-item").first()).toContainText("sample.ts");
  await expect(page.locator(".maldives-file-switcher-item").first()).toContainText("/maldives/sample.ts");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/goto-file-switcher-proof.png" });

  await page.locator(".maldives-file-switcher-item").first().click();
  await expect(page.locator(".maldives-file-switcher")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.hasTextFocus())).toBe(true);
});

test("recent locations overlay restores a deterministic model position", async ({ page }) => {
  await loadEditor(page);

  const opened = await page.evaluate(() => {
    const sampleModel = window.__monaco.editor.getModel(window.__monaco.Uri.parse("file:///maldives/sample.ts"));
    const secondModel = window.__monaco.editor.getModel(window.__monaco.Uri.parse("file:///maldives/second.ts"));

    if (!sampleModel || !secondModel) {
      return false;
    }

    window.__maldivesEditor.setModel(sampleModel);
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 7 });
    window.__maldivesEditor.setModel(secondModel);
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 14 });

    return window.__maldivesExecuteKeybinding("RecentLocations");
  });

  expect(opened).toBe(true);
  await page.locator(".maldives-recent-locations").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".maldives-recent-locations")).toContainText("Recent Locations");
  await expect(page.locator(".maldives-recent-locations")).toContainText("/maldives/second.ts:2:14");

  const sampleLocation = page.locator(".maldives-recent-locations-item").filter({ hasText: "/maldives/sample.ts:2:7" }).first();
  await expect(sampleLocation).toContainText("const camelCaseWord");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/recent-locations-proof.png" });

  await sampleLocation.click();

  await expect(page.locator(".maldives-recent-locations")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.path)).toBe("/maldives/sample.ts");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition())).toEqual({ lineNumber: 2, column: 7 });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.hasTextFocus())).toBe(true);
});

test("viewport and split-line keybindings move the cursor, center the viewport, and split a line", async ({ page }) => {
  await loadEditor(page);

  const pageDownResult = await page.evaluate(() => {
    window.__maldivesEditor.setValue(Array.from({ length: 160 }, (_, index) => `line ${index + 1}`).join("\n"));
    window.__maldivesEditor.setPosition({ lineNumber: 40, column: 3 });
    window.__maldivesEditor.setScrollTop(0);
    window.__maldivesEditor.focus();

    return {
      executed: window.__maldivesExecuteKeybinding("EditorPageDown"),
      position: window.__maldivesEditor.getPosition(),
    };
  });

  expect(pageDownResult.executed).toBe(true);
  expect(pageDownResult.position?.lineNumber ?? 0).toBeGreaterThan(40);

  const pageUpResult = await page.evaluate(() => {
    const before = window.__maldivesEditor.getPosition();

    return {
      before,
      executed: window.__maldivesExecuteKeybinding("EditorPageUp"),
      after: window.__maldivesEditor.getPosition(),
    };
  });

  expect(pageUpResult.executed).toBe(true);
  expect(pageUpResult.after?.lineNumber ?? Number.POSITIVE_INFINITY).toBeLessThan(pageUpResult.before?.lineNumber ?? 0);

  const centered = await page.evaluate(() => {
    window.__maldivesEditor.setPosition({ lineNumber: 120, column: 1 });
    window.__maldivesEditor.setScrollTop(0);

    return window.__maldivesExecuteKeybinding("EditorScrollToCenter");
  });

  expect(centered).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const position = window.__maldivesEditor.getScrolledVisiblePosition({ lineNumber: 120, column: 1 });

        return position ? position.top : -1;
      }),
    )
    .toBeGreaterThan(100);

  const splitResult = await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha beta");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 7 });

    return {
      executed: window.__maldivesExecuteKeybinding("EditorSplitLine"),
      value: window.__maldivesEditor.getValue(),
      position: window.__maldivesEditor.getPosition(),
    };
  });

  expect(splitResult.executed).toBe(true);
  expect(splitResult.value.replace(/\r\n/g, "\n")).toBe("alpha \nbeta");
  expect(splitResult.position).toEqual({ lineNumber: 1, column: 7 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p6c-viewport-proof.png" });
});

test("folding keybindings collapse selection and all regions", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue([
      "function alpha() {",
      "  const one = 1;",
      "  return one;",
      "}",
      "",
      "function beta() {",
      "  const two = 2;",
      "  return two;",
      "}",
    ].join("\n"));
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
    window.__maldivesEditor.setScrollTop(0);
    window.__maldivesEditor.focus();
  });
  await expectLineVisible(page, 2, true);
  await expectLineVisible(page, 7, true);

  expect(await page.evaluate(() => window.__maldivesExecuteKeybinding("CollapseSelection"))).toBe(true);
  await expectLineVisible(page, 2, false);

  expect(await page.evaluate(() => window.__maldivesExecuteKeybinding("ExpandAll"))).toBe(true);
  await expectLineVisible(page, 2, true);

  expect(await page.evaluate(() => window.__maldivesExecuteKeybinding("CollapseAll"))).toBe(true);
  await expectLineVisible(page, 2, false);
  await expectLineVisible(page, 7, false);

  expect(await page.evaluate(() => window.__maldivesExecuteKeybinding("ExpandAll"))).toBe(true);
  await expectLineVisible(page, 2, true);
  await expectLineVisible(page, 7, true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p6b-folding-proof.png" });
});

test("registered addCommand keybindings work across groups", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("alpha alpha alpha");
    window.__maldivesEditor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 6 });
    return window.__maldivesExecuteKeybinding("SelectNextOccurrence");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getSelections()?.length ?? 0)).toBeGreaterThan(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
    return window.__maldivesExecuteKeybinding("EditorNextWordInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.column ?? 1)).toBeGreaterThan(1);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 6 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToWordEndInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("camelWord");

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("camelCaseWord");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 10 });
    return window.__maldivesExecuteKeybinding("EditorDeleteToWordStartInDifferentHumpsMode");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("camelWord");

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("one\ntwo");
    window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
    return window.__maldivesExecuteKeybinding("MoveLineDown");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe("two\none");

  await expect(
    page.evaluate(() => {
      window.__maldivesEditor.setValue("function f() {\n  return 1;\n}\n");
      window.__maldivesEditor.setPosition({ lineNumber: 1, column: 1 });
      return window.__maldivesExecuteKeybinding("CollapseRegion");
    }),
  ).resolves.toBe(true);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue("const x = 1;");
    window.__maldivesEditor.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 13 });
    return window.__maldivesExecuteKeybinding("CommentByBlockComment");
  });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("/*");

  await expect(
    page.evaluate(() => {
      window.__maldivesEditor.setValue("const  x=1");
      return window.__maldivesExecuteKeybinding("ReformatCode");
    }),
  ).resolves.toBe(true);

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/keybindings-proof.png" });
});
