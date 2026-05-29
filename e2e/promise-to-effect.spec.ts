import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}


test("Promise to Effect.gen code action rewrites an async function", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    window.__maldivesEditor.setValue([
      "async function loadName(): Promise<string> {",
      "  const name = await fetchName();",
      "  return name;",
      "}",
      "",
      "function fetchName(): Promise<string> {",
      "  return Promise.resolve(\"Ada\");",
      "}",
    ].join("\n"));
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: 23 });
    window.__maldivesEditor.focus();
  });

  const convertAction = page.locator('.action-widget .monaco-list-row:has-text("Convert to Effect.gen")');
  await expect(async () => {
    const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("IntroduceActionsGroup"));
    expect(opened).toBe(true);
    await convertAction.waitFor({ state: "visible", timeout: 1000 });
  }).toPass({ timeout: 15000 });
  await page.keyboard.press("Enter");

  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toContain("Effect.gen(function*");
  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toContain("yield* Effect.tryPromise(() => fetchName())");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p12c-promise-to-effect-proof.png" });
});

test("Promise to Effect.gen code action stays hidden for unsafe real TSX shapes", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate(() => {
    const source = [
      'import { Effect, Layer, Schema, pipe } from "effect";',
      "",
      "declare function fetchName(id: string): Promise<string>;",
      "function logged(_target: unknown, _key: string, descriptor: PropertyDescriptor) { return descriptor; }",
      "const User = Schema.Struct({ id: Schema.String });",
      "const LiveLayer = Layer.succeed('Repository', {});",
      "",
      "class Repository<T extends { id: string }> {",
      "  @logged",
      "  async loadAll(ids: readonly string[]): Promise<readonly string[]> {",
      "    const program = Effect.gen(function* () { return yield* Effect.succeed(ids.length); });",
      "    const described = pipe(User, () => LiveLayer);",
      "    return ids.map(async (id) => await fetchName(id));",
      "  }",
      "}",
    ].join("\n");
    window.__maldivesEditor.setValue(source);
    window.__maldivesEditor.setPosition({ lineNumber: 13, column: 35 });
    window.__maldivesEditor.focus();
  });

  const opened = await page.evaluate(() => window.__maldivesExecuteKeybinding("IntroduceActionsGroup"));
  expect(opened).toBe(true);
  await expect(page.locator('.action-widget .monaco-list-row:has-text("Convert to Effect.gen")')).toHaveCount(0, { timeout: 2000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p14d-promise-refactor-hidden-proof.png" });
});
