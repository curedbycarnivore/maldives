import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const complexEffectTsx = `import { Effect, Layer, Schema, pipe } from "effect";

function sealed(): ClassDecorator {
  return () => undefined;
}

@sealed()
class Repository<T extends { id: string }> {
  constructor(readonly rows: ReadonlyArray<T>) {}

  find<A extends T>(id: string): Effect.Effect<A, Error, never> {
    return pipe(
      Effect.succeed(this.rows.find((row): row is A => row.id === id)),
      Effect.flatMap((row) => row ? Effect.succeed(row) : Effect.fail(new Error(id))),
    );
  }
}

const User = Schema.Struct({ id: Schema.String, name: Schema.String });
type User = typeof User.Type;
const UserRepo = Layer.effect("UserRepo", Effect.succeed(new Repository<User>([{ id: "1", name: "Ada" }])));

export function loadUser(id: string) {
  return Effect.gen(function* () {
    const repo = yield* Effect.succeed(new Repository<User>([{ id, name: "Grace" }]));
    return yield* repo.find<User>(id);
  });
}
`;

test("P11b boots the VSCode TypeScript extension host overlay for a real Effect TSX file", async ({ page }) => {
  await loadEditor(page);

  const bootstrap = await page.evaluate(async ({ source }) => {
    const ready = window.__maldivesVscodeTsWorkerReady;
    if (!ready) {
      throw new Error("missing __maldivesVscodeTsWorkerReady");
    }

    const result = await ready;
    const uri = window.__monaco.Uri.parse("file:///workspace/src/real-user-effect.tsx");
    const model = window.__monaco.editor.createModel(source, "typescript", uri);
    window.__maldivesEditor.setModel(model);
    return {
      ...result,
      diagnostics: window.__monaco.languages.typescript.typescriptDefaults.getDiagnosticsOptions(),
      lineCount: model.getLineCount(),
    };
  }, { source: complexEffectTsx });

  expect(bootstrap.stockDiagnosticsDisabled).toBe(true);
  expect(bootstrap.diagnostics).toMatchObject({ noSemanticValidation: true, noSuggestionDiagnostics: true });
  expect(bootstrap.overlayFiles).toContain("file:///node_modules/effect/index.d.ts");
  expect(bootstrap.overlayFiles).toContain("file:///workspace/tsconfig.json");
  expect(bootstrap.lineCount).toBeGreaterThan(25);
  await expect(page.locator(".view-line").filter({ hasText: "class Repository" })).toBeVisible();
  await expect(page.locator(".view-line").filter({ hasText: "Effect.gen" })).toBeVisible();

  await page.screenshot({ path: "proof/p11b-vscode-ts-worker-proof.png" });
});
