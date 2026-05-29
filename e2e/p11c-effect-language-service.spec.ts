import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const complexEffectSource = `import { Effect, Layer, Schema, pipe } from "effect";

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

export const floatingProgram = Effect.gen(function* () {
  Effect.succeed("floating");
  return yield* Effect.succeed(UserRepo);
});

export async function loadUser(id: string) {
  const response = await fetch("/users/" + id);
  return response.json() as Promise<User>;
}
`;

test("P11c renders official Effect language-service diagnostics and offers async-to-Effect refactor", async ({ page }) => {
  await loadEditor(page);

  const proof = await page.evaluate(async ({ source }) => {
    const uri = window.__monaco.Uri.parse("file:///workspace/src/p11c-real-user-effect.tsx");
    const model = window.__monaco.editor.createModel(source, "typescript", uri);
    window.__maldivesEditor.setModel(model);
    window.__maldivesEditor.setPosition({ lineNumber: 28, column: 8 });
    await window.__maldivesEffectLanguageService.refreshModel(model);

    return {
      diagnostics: window.__maldivesEffectLanguageService.getDiagnostics(model).map((diagnostic) => ({
        code: diagnostic.code,
        rule: diagnostic.rule,
        message: diagnostic.message,
      })),
      refactors: window.__maldivesEffectLanguageService.getRefactors(model, {
        pos: model.getOffsetAt({ lineNumber: 28, column: 8 }),
        end: model.getOffsetAt({ lineNumber: 31, column: 2 }),
      }),
    };
  }, { source: complexEffectSource });

  expect(proof.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rule: "floatingEffect", message: expect.stringContaining("This Effect value is neither yielded") }),
    ]),
  );
  expect(proof.refactors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ description: "Convert to Effect.gen", actions: expect.arrayContaining(["Rewrite to Effect.gen"]) }),
    ]),
  );

  await expect.poll(() => page.locator(".squiggly-error").count(), { timeout: 15000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.__maldivesEditor.getAction("editor.action.refactor")?.run());
  await page.locator(".action-widget").waitFor({ state: "visible", timeout: 8000 });
  await expect(page.locator(".action-widget")).toContainText("Rewrite to Effect.gen");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p11c-effect-language-service-proof.png" });
});
