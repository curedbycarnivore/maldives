import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const complexEffectSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function injectable(_: unknown, _context: ClassDecoratorContext) {}

@injectable
class ToggleRepository<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String, value: Schema.Number });

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(this.schema)({ id, value: 1 });
      return { ...parsed, seed: id } satisfies A & { readonly seed: string };
    }.bind(this));
  }
}

const ToggleRepo = Context.GenericTag<ToggleRepository<{ readonly id: string }>>("ToggleRepository");
export const ToggleRepoLive = Layer.succeed(ToggleRepo, new ToggleRepository({ id: "seed" }));
export const program = pipe(Effect.succeed("42"), Effect.flatMap((id) => new ToggleRepository({ id }).load(id)));
`;

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesWorkspace: { open(uri: string, content: string): unknown; mode: "read" | "write" };
    __maldivesFileSystemAdapter: { writeFile: (path: string, content: string, options?: { userGesture?: boolean }) => Promise<void> };
    __maldivesExecuteKeybinding: (wsActionId: string) => boolean;
  }
}

test("P17a3 cannot be bypassed into write mode by URL and preserves read-only bytes on blur", async ({ page }) => {
  await page.goto("http://127.0.0.1:5173/?maldivesWriteMode=1", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesReady)).catch(() => false), { timeout: 120000 }).toBe(true);
  await expect(async () => {
    await page.evaluate(() => window.__maldivesReady);
  }).toPass({ timeout: 120000 });

  await expect(page.locator(".maldives-readwrite-toggle")).toHaveText(/🔒 Read-only/);
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.mode)).toBe("read");

  const trailingWhitespaceSource = `${complexEffectSource}\nconst preserveWhitespace = true;   `;
  await page.evaluate((source) => {
    window.__maldivesWorkspace.open("file:///read-only-preserve.tsx", source);
  }, trailingWhitespaceSource);
  await page.locator(".monaco-editor").click();
  await page.locator(".maldives-readwrite-toggle").focus();

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe(trailingWhitespaceSource);
});

test("P17a3 read/write toggle blocks custom edits and saves until explicitly clicked", async ({ page }) => {
  await loadEditor(page, { mode: "read" });

  await page.evaluate((source) => {
    window.__maldivesWorkspace.open("file:///effect-toggle.tsx", source);
    window.__maldivesEditor.setPosition({ lineNumber: 6, column: 1 });
    const calls: Array<{ path: string; content: string; userGesture: boolean }> = [];
    window.__maldivesFileSystemAdapter.writeFile = async (path, content, options = {}) => {
      calls.push({ path, content, userGesture: Boolean(options.userGesture) });
    };
    (window as unknown as { __p17a3WriteCalls: typeof calls }).__p17a3WriteCalls = calls;
  }, complexEffectSource);

  await expect(page.locator(".maldives-readwrite-toggle")).toHaveText(/🔒 Read-only/);
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.mode)).toBe("read");

  await page.locator(".monaco-editor").click();
  await page.keyboard.type("SHOULD_NOT_APPEAR");
  await page.evaluate(() => window.__maldivesExecuteKeybinding("EditorCompleteStatement"));
  await page.evaluate(() => window.__maldivesExecuteKeybinding("MoveStatementDown"));
  await page.evaluate(() => window.__maldivesEditor.trigger("maldives-test", "maldives.saveActiveFile", null));

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toBe(complexEffectSource);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __p17a3WriteCalls: unknown[] }).__p17a3WriteCalls.length)).toBe(0);
  await expect(page.locator(".maldives-readwrite-status")).toHaveText(/Switch to Write mode to edit/);

  await page.locator(".maldives-readwrite-toggle").click();
  await expect(page.locator(".maldives-readwrite-toggle")).toHaveText(/🔓 Write/);
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.mode)).toBe("write");

  await page.evaluate(() => {
    window.__maldivesEditor.setPosition({ lineNumber: 20, column: 1 });
    window.confirm = () => true;
    window.__maldivesEditor.trigger("maldives-test", "type", { text: "// write-mode edit\n" });
    window.__maldivesEditor.trigger("maldives-test", "maldives.saveActiveFile", null);
  });

  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("// write-mode edit");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __p17a3WriteCalls: unknown[] }).__p17a3WriteCalls.length)).toBe(1);

  await page.screenshot({ path: "proof/p17a3-readwrite-toggle.png" });
});
