import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const sources = {
  app: `import { Effect, Layer, Schema, pipe } from "effect";

function Injectable(): ClassDecorator { return () => undefined; }

@Injectable()
export class P16BSplitApp<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  readonly program = pipe(
    Effect.gen(function* () {
      const value = yield* Effect.succeed({ id: "app" } as A);
      return this.schema.make({ id: value.id });
    }),
    Effect.provide(Layer.empty),
  );
}
`,
  repo: `import { Effect, Context } from "effect";

export interface P16BSplitRecord<A> { readonly value: A; }
export class P16BSplitRepository<A extends string> {
  find(id: A): Effect.Effect<P16BSplitRecord<A>> {
    return Effect.succeed({ value: id });
  }
}
export const P16BSplitRepo = Context.GenericTag<P16BSplitRepository<string>>("P16BSplitRepo");
`,
};

declare global {
  interface Window {
    __maldivesWorkspace: {
      open(uri: string, content: string): unknown;
      splitRight(uri?: string): { id: string; uri: string; direction: string };
      splitDown(uri?: string): { id: string; uri: string; direction: string };
      panes(): Array<{ id: string; uri: string; direction: string }>;
    };
  }
}

test("P16b renders split panes and supports drag-to-rearrange", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate((value) => {
    window.__maldivesWorkspace.open("file:///p16b/app.tsx", value.app);
    window.__maldivesWorkspace.open("file:///p16b/repo.ts", value.repo);
    window.__maldivesWorkspace.splitRight("file:///p16b/app.tsx");
    window.__maldivesWorkspace.splitDown("file:///p16b/repo.ts");
  }, sources);

  const panes = page.locator(".maldives-workspace-split-pane");
  await expect(panes).toHaveCount(3);
  await expect(panes.nth(0)).toContainText("repo.ts");
  await expect(panes.nth(1)).toContainText("app.tsx");
  await expect(panes.nth(2)).toContainText("repo.ts");
  await expect(page.locator(".maldives-workspace-split-layout")).toContainText("P16BSplitApp");

  await panes.nth(2).dragTo(panes.nth(0));
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.panes().map((pane) => pane.id))).toEqual([
    "pane-3",
    "pane-1",
    "pane-2",
  ]);
  await expect(panes.nth(0)).toContainText("repo.ts");
  await expect(panes.nth(0)).toContainText("down");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p16b-splits.png" });
});
