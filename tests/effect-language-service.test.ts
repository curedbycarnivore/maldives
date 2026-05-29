import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildVscodeTypeScriptOverlay } from "../src/vscode-ts-worker";
import {
  createEffectLanguageServiceSnapshot,
  effectLanguageServicePluginConfig,
} from "../src/effect-language-service";

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

describe("P11c Effect language service integration", () => {
  test("pins @effect/language-service and makes the full e2e gate fail on zero tests", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
      scripts: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.["@effect/language-service"]).toBe("0.86.2");
    expect(packageJson.scripts["test:e2e"]).toBe("playwright test");
  });

  test("mounts the official Effect tsserver plugin in the VSCode TS overlay tsconfig", () => {
    const overlay = buildVscodeTypeScriptOverlay();
    const tsconfig = JSON.parse(overlay.files.get("file:///workspace/tsconfig.json") ?? "{}");

    expect(tsconfig.compilerOptions.plugins).toEqual([effectLanguageServicePluginConfig]);
  });

  test("uses the official plugin to report floating Effect diagnostics and async-to-Effect refactors", () => {
    const snapshot = createEffectLanguageServiceSnapshot({
      path: "/workspace/src/real-user-effect.tsx",
      source: complexEffectSource,
    });

    expect(snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 3,
          rule: "floatingEffect",
          message: expect.stringContaining("This Effect value is neither yielded"),
        }),
      ]),
    );
    expect(snapshot.refactors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "@effect/language-service/refactors/asyncAwaitToGen",
          description: "Convert to Effect.gen",
          actions: expect.arrayContaining(["Rewrite to Effect.gen"]),
        }),
      ]),
    );
  });
});
