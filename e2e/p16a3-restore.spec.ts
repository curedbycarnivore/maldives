import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const restoreSources = {
  app: `import { Effect, Layer, Schema, pipe } from "effect";

function P16A3Injectable(): ClassDecorator { return () => undefined; }

@P16A3Injectable()
export class P16A3RestoredApp<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  readonly program = pipe(
    Effect.gen(function* () {
      const value = yield* Effect.succeed({ id: "restore" } as A);
      return this.schema.make({ id: value.id });
    }),
    Effect.provide(Layer.empty),
  );
}
`,
  repo: `import { Effect, Context } from "effect";

export class P16A3RestoredRepo<A extends string> {
  find(id: A): Effect.Effect<{ readonly id: A }> {
    return Effect.succeed({ id });
  }
}
export const P16A3Repo = Context.GenericTag<P16A3RestoredRepo<string>>("P16A3Repo");
`,
};

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesWorkspace: {
      open(uri: string, content: string): unknown;
      activeUri?: string;
      uris(): string[];
      isDirty(uri: string): boolean;
      cursor(uri: string): { lineNumber: number; column: number } | undefined;
    };
  }
}

test("P16a3 persists open tabs, edited content, and cursor across reload", async ({ page }) => {
  await loadEditor(page);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await loadEditor(page);

  await page.evaluate((sources) => {
    window.__maldivesWorkspace.open("file:///p16a3/app.tsx", sources.app);
    window.__maldivesWorkspace.open("file:///p16a3/repo.ts", sources.repo);
    window.__maldivesWorkspace.open("file:///p16a3/app.tsx", sources.app);
  }, restoreSources);

  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.activeUri)).toBe("file:///p16a3/app.tsx");
  await page.locator(".monaco-editor").click();
  await page.evaluate(() => window.__maldivesEditor.setPosition({ lineNumber: 8, column: 12 }));
  await page.keyboard.type("// P16A3 persisted dirty edit\n");
  await page.evaluate(() => window.__maldivesEditor.setPosition({ lineNumber: 8, column: 12 }));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getPosition()?.lineNumber)).toBe(8);
  await page.locator(".maldives-workspace-tab").filter({ hasText: "repo.ts" }).click();
  await page.locator(".maldives-workspace-tab").filter({ hasText: "app.tsx" }).click();
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.isDirty("file:///p16a3/app.tsx"))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("maldives.workspace.v1") ?? "")).toContain("file:///p16a3/app.tsx");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("maldives.workspace.v1") ?? "")).toContain('"lineNumber":8');

  await page.goto("about:blank");
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(() => Boolean(window.__maldivesEditor))).toBe(true);
  await page.evaluate(() => window.__maldivesReady);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("maldives.workspace.v1") ?? "")).toContain("file:///p16a3/app.tsx");
  await expect(page.locator(".maldives-workspace-tab").filter({ hasText: "app.tsx" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".maldives-workspace-tab").filter({ hasText: "repo.ts" })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.uris())).toEqual(expect.arrayContaining([
    "file:///p16a3/app.tsx",
    "file:///p16a3/repo.ts",
  ]));
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("P16A3 persisted dirty edit");
  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p16a3-restore.png" });
});
