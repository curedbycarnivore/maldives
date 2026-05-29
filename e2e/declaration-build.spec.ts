import { mkdir, readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

const realUserTsx = `import { Effect, Layer, Schema, pipe } from "effect";

function Service(): ClassDecorator {
  return () => undefined;
}

@Service()
class DeclarationBuildService<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });

  run(value: A) {
    return Effect.gen(function* () {
      const parsed = yield* Effect.succeed(value.id);
      return pipe(parsed, (id) => ({ id, ok: true as const }));
    });
  }
}

const LiveLayer = Layer.succeed(DeclarationBuildService, new DeclarationBuildService());
export const App = () => <section>{String(LiveLayer)}</section>;
`;

test("declaration build keeps the runtime editor bootable", async ({ page }) => {
  const declaration = await readFile("dist/index.d.ts", "utf-8");
  expect(declaration).toContain("createMaldivesEditor");
  expect(declaration).toContain("EffectDtsFiles");

  await loadEditor(page);

  const runtimeValue = await page.evaluate(async (source) => {
    const module = (await import("/dist/index.js")) as typeof import("../src");
    const container = document.createElement("div");
    container.id = "declaration-build-runtime-editor";
    container.style.width = "900px";
    container.style.height = "520px";
    container.style.position = "fixed";
    container.style.inset = "24px";
    container.style.zIndex = "10";
    document.body.append(container);

    const handle = module.createMaldivesEditor(container);
    handle.editor.setValue(source);
    handle.editor.layout();

    return {
      value: handle.editor.getValue(),
      hasDispose: typeof handle.dispose === "function",
    };
  }, realUserTsx);

  expect(runtimeValue.value).toBe(realUserTsx);
  expect(runtimeValue.hasDispose).toBe(true);
  await expect(page.locator("#declaration-build-runtime-editor")).toContainText("DeclarationBuildService");

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/p13-declaration-build-proof.png" });
});
