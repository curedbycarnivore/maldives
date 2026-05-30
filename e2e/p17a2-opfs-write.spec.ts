import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const opfsPath = "/p17a2/effect-daily-driver.tsx";
const opfsSource = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function service(_: unknown, _context: ClassDecoratorContext) {}

@service
class OpfsDailyDriver<A extends { readonly id: string }> {
  readonly entity = Schema.Struct({ id: Schema.String, count: Schema.Number });

  constructor(readonly seed: A) {}

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(this.entity)({ id, count: 1 });
      return { ...parsed, seed: this.seed };
    });
  }
}

const Repository = Context.GenericTag<OpfsDailyDriver<{ readonly id: string }>>("Repository");
const RepositoryLive = Layer.succeed(Repository, new OpfsDailyDriver({ id: "opfs" }));

export const program = pipe(
  Effect.succeed("daily-driver"),
  Effect.flatMap((id) => new OpfsDailyDriver({ id }).load(id)),
  Effect.provide(RepositoryLive),
);
`;

test("P17a2 writes a complex TSX file to OPFS, reopens it, and persists across reload", async ({ page }) => {
  await loadEditor(page);

  const firstReadBack = await page.evaluate(async ({ path, source }) => {
    const { OpfsFileSystemAdapter } = await import("/src/fs/opfs-adapter.ts");
    const writer = new OpfsFileSystemAdapter();
    await writer.writeFile(path, source);

    const reopened = new OpfsFileSystemAdapter();
    return reopened.readFile(path);
  }, { path: opfsPath, source: opfsSource });

  expect(firstReadBack).toBe(opfsSource);

  await page.reload({ waitUntil: "domcontentloaded" });
  await loadEditor(page);

  const persistedReadBack = await page.evaluate(async ({ path }) => {
    const { OpfsFileSystemAdapter } = await import("/src/fs/opfs-adapter.ts");
    return new OpfsFileSystemAdapter().readFile(path);
  }, { path: opfsPath });

  expect(persistedReadBack).toBe(opfsSource);

  await page.evaluate(({ path, source }) => {
    const uri = window.__monaco.Uri.parse(`opfs://${path}`);
    const existing = window.__monaco.editor.getModel(uri);
    const model = existing ?? window.__monaco.editor.createModel(source, "typescript", uri);
    model.setValue(source);
    window.__maldivesEditor.setModel(model);
  }, { path: opfsPath, source: persistedReadBack });

  await expect(page.locator(".view-line", { hasText: "OpfsDailyDriver" }).first()).toBeVisible({ timeout: 15000 });
  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p17a2-opfs-write-proof.png" });
});
