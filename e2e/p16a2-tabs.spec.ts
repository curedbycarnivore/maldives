import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const tabSources = {
  app: `import { Effect, Layer, Schema, pipe } from "effect";

function Injectable(): ClassDecorator { return () => undefined; }

@Injectable()
export class P16A2AppService<A extends { readonly id: string }> {
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

export interface P16A2Record<A> { readonly value: A; }
export class P16A2Repository<A extends string> {
  find(id: A): Effect.Effect<P16A2Record<A>> {
    return Effect.succeed({ value: id });
  }
}
export const P16A2Repo = Context.GenericTag<P16A2Repository<string>>("P16A2Repo");
`,
  service: `import { Effect, pipe } from "effect";
import { P16A2Repository } from "./repo";

export class P16A2Service<T extends string> {
  constructor(readonly repo: P16A2Repository<T>) {}
  readonly load = (id: T) => pipe(
    this.repo.find(id),
    Effect.map((record) => record.value.toUpperCase()),
  );
}
`,
};

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesWorkspace: {
      open(uri: string, content: string): unknown;
      uris(): string[];
      activeUri?: string;
      isDirty(uri: string): boolean;
    };
  }
}

test("P16a2 renders workspace tabs, preserves dirty content while switching, and closes tabs", async ({ page }) => {
  await loadEditor(page);

  await page.evaluate((sources) => {
    window.__maldivesWorkspace.open("file:///p16a2/app.tsx", sources.app);
    window.__maldivesWorkspace.open("file:///p16a2/repo.ts", sources.repo);
    window.__maldivesWorkspace.open("file:///p16a2/service.tsx", sources.service);
  }, tabSources);

  const tabs = page.locator(".maldives-workspace-tab");
  await expect(tabs).toHaveCount(5);
  await expect(tabs.filter({ hasText: "service.tsx" })).toHaveAttribute("aria-selected", "true");

  await tabs.filter({ hasText: "app.tsx" }).click();
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.activeUri)).toBe("file:///p16a2/app.tsx");
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("P16A2AppService");

  await page.locator(".monaco-editor").click();
  await page.keyboard.type("// P16A2 dirty app edit\n");
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.isDirty("file:///p16a2/app.tsx"))).toBe(true);
  await expect(tabs.filter({ hasText: "app.tsx" }).locator(".maldives-workspace-tab-dirty")).toBeVisible();

  await tabs.filter({ hasText: "repo.ts" }).click();
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("P16A2Repository");
  await expect(tabs.filter({ hasText: "app.tsx" }).locator(".maldives-workspace-tab-dirty")).toBeVisible();

  await tabs.filter({ hasText: "app.tsx" }).click();
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getValue())).toContain("P16A2 dirty app edit");

  await tabs.filter({ hasText: "repo.ts" }).locator(".maldives-workspace-tab-close").click();
  await expect(tabs.filter({ hasText: "repo.ts" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__maldivesWorkspace.uris())).not.toContain("file:///p16a2/repo.ts");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p16a2-tabs.png" });
});
