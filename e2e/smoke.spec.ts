import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadEditor } from "./helpers/load-editor";

test("exposes the Maldives Monaco editor", async ({ page }) => {
  await loadEditor(page);
  await expect(page.evaluate(() => Boolean(window.__monaco))).resolves.toBe(true);

  const roundTripBuffer = [
    "import { Effect, Layer, Schema, pipe } from \"effect\";",
    "",
    "function Injectable(): ClassDecorator {",
    "  return () => undefined;",
    "}",
    "",
    "@Injectable()",
    "class P29SmokeService<T extends { readonly id: string }> {",
    "  readonly schema = Schema.Struct({ id: Schema.String });",
    "",
    "  load(input: T) {",
    "    return pipe(",
    "      Effect.gen(function* () {",
    "        const value = yield* Effect.succeed(input.id);",
    "        return { value, layer: Layer.empty } as const;",
    "      }),",
    "      Effect.map((result) => result.value),",
    "    );",
    "  }",
    "}",
    "",
    "new P29SmokeService<{ readonly id: string }>().load({ id: \"proof\" });",
  ].join("\n");

  await page.evaluate((value) => {
    window.__maldivesEditor.setValue(value);
    window.__maldivesEditor.setPosition({ lineNumber: 8, column: 7 });
    window.__maldivesEditor.revealLineInCenter(8);
    window.__maldivesEditor.focus();
  }, roundTripBuffer);

  await expect
    .poll(() => page.evaluate(() => window.__maldivesEditor.getValue()))
    .toBe(roundTripBuffer);
  await expect(page.locator(".view-line").filter({ hasText: "P29SmokeService" }).first()).toBeVisible();

  await mkdir("proof", { recursive: true });
  await page.screenshot({ path: "proof/editor-smoke.png" });
});
