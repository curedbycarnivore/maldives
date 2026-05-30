import { mkdir, readFile } from "node:fs/promises";
import { expect, test, type Route } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __monaco: typeof import("monaco-editor");
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
    __maldivesInit?: { git?: { origin: string; repo: string; token: string } };
  }
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "x-maldives-workspace-token, accept",
  "access-control-allow-methods": "GET, OPTIONS",
};

async function fulfillJson(route: Route, value: unknown): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: corsHeaders });
    return;
  }

  await route.fulfill({ headers: corsHeaders, json: value });
}

test("P24a renders Take5 git status, inline diff, and blame hover for the active real TSX file", async ({ page }) => {
  await page.addInitScript(() => {
    window.__maldivesInit = {
      git: { origin: "http://127.0.0.1:5173", repo: "maldives", token: "session-token" },
    };
  });
  await page.route("http://127.0.0.1:5173/workspace/maldives/git/status", async (route) => {
    await fulfillJson(route, [{ path: "/src/effect-stress-app.tsx", status: "modified", lines: [180, 181, 182] }]);
  });
  await page.route("http://127.0.0.1:5173/workspace/maldives/git/blame?*", async (route) => {
    await fulfillJson(route, {
      path: "/src/effect-stress-app.tsx",
      line: 180,
      author: "Ada Lovelace",
      commit: "abc1234",
      summary: "Wire real Effect repository",
    });
  });
  await page.route("http://127.0.0.1:5173/workspace/maldives/git/diff?*", async (route) => {
    await fulfillJson(route, [
      {
        path: "/src/effect-stress-app.tsx",
        oldStart: 176,
        oldLines: 3,
        newStart: 176,
        newLines: 4,
        lines: ["@@ -176,3 +176,4 @@", " export const stressProgram = pipe(", "+  Effect.annotateLogs(\"git\", \"take5\"),"],
      },
    ]);
  });

  await loadEditor(page);
  const stressSource = await readFile("e2e/fixtures/effect-stress-app.tsx", "utf-8");
  await page.evaluate((source) => {
    const uri = window.__monaco.Uri.parse("file:///workspace/src/effect-stress-app.tsx");
    const model = window.__monaco.editor.createModel(source, "typescript", uri);
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.setPosition({ lineNumber: 180, column: 1 });
    window.__maldivesEditor.focus();
  }, stressSource);

  await expect.poll(() => page.evaluate(() => window.__maldivesExecuteKeybinding("Annotate"))).toBe(true);
  await expect(page.locator(".maldives-vcs-panel")).toBeVisible();
  await expect(page.locator(".maldives-vcs-body")).toContainText("Take5 status: modified /src/effect-stress-app.tsx");
  await expect(page.locator(".maldives-vcs-body")).toContainText("Blame: Ada Lovelace abc1234 — Wire real Effect repository");
  await expect(page.locator(".maldives-vcs-body")).toContainText("+  Effect.annotateLogs(\"git\", \"take5\"),");

  const gitDecorations = await page.evaluate(() =>
    window.__maldivesEditor
      .getModel()
      ?.getAllDecorations()
      .filter((decoration) => decoration.options.linesDecorationsClassName?.includes("maldives-git-line-modified"))
      .map((decoration) => ({
        line: decoration.range.startLineNumber,
        hover: Array.isArray(decoration.options.hoverMessage)
          ? decoration.options.hoverMessage.map((message) => message.value).join("\n")
          : decoration.options.hoverMessage?.value,
      })) ?? [],
  );
  expect(gitDecorations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ line: 180, hover: expect.stringContaining("Ada Lovelace abc1234") }),
    ]),
  );

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p24a-git-state.png" });
});
