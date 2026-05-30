import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

declare global {
  interface Window {
    __maldivesEditor: import("monaco-editor").editor.IStandaloneCodeEditor;
    __maldivesWorkspace: { open(uri: string, content: string): unknown };
    __maldivesCrossFileLsp: { goToDefinition(): Promise<{ ok: boolean; uri?: string }> };
  }
}

const stressSource = readFileSync("e2e/fixtures/effect-stress-app.tsx", "utf-8");

const repoSource = `import { Effect, Schema } from "effect";

export interface UserRecord<A> {
  readonly id: string;
  readonly value: A;
}

export class UserRepository<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });

  findAll(): Effect.Effect<ReadonlyArray<UserRecord<A>>> {
    return Effect.succeed([]);
  }
}
`;

const appSource = `import { Effect, Layer, pipe } from "effect";
import { UserRepository } from "./repo";

function sealed(_target: Function) {}

@sealed
export class P31BCrossFileService<T extends { readonly id: string }> {
  constructor(readonly repo: UserRepository<T>) {}

  readonly program = pipe(
    Effect.gen(function* () {
      const rows = yield* this.repo.findAll();
      return rows.map((row) => row.id).join(",");
    }),
    Effect.provide(Layer.succeed(UserRepository, this.repo)),
  );
}

export const service = new P31BCrossFileService(new UserRepository<{ readonly id: string }>());
`;

test("P31b navigates from an imported symbol to its open workspace file through TypeScript go-to-definition", async ({ page }) => {
  await loadEditor(page);

  const setup = await page.evaluate(({ repo, app, stress }) => {
    window.__maldivesWorkspace.open("file:///p31b/src/repo.ts", repo);
    window.__maldivesWorkspace.open("file:///p31b/src/app.tsx", app + "\n" + stress.slice(0, 600));
    const model = window.__maldivesEditor.getModel();
    const line = model?.getLineContent(2) ?? "";
    const column = line.indexOf("UserRepository") + 1;
    window.__maldivesEditor.setPosition({ lineNumber: 2, column: column + 2 });
    return { uri: model?.uri.toString(), line, column };
  }, { repo: repoSource, app: appSource, stress: stressSource });

  expect(setup.uri).toBe("file:///p31b/src/app.tsx");
  expect(setup.line).toContain("UserRepository");
  expect(setup.column).toBeGreaterThan(0);

  const navigated = await page.evaluate(async () => window.__maldivesCrossFileLsp.goToDefinition());

  expect(navigated).toMatchObject({ ok: true, uri: "file:///p31b/src/repo.ts" });
  await expect.poll(() => page.evaluate(() => window.__maldivesEditor.getModel()?.uri.toString()), { timeout: 15000 }).toBe("file:///p31b/src/repo.ts");
  await expect(page.locator(".view-line", { hasText: "class UserRepository" }).first()).toBeVisible({ timeout: 15000 });

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p31b-cross-file-lsp.png" });
});
