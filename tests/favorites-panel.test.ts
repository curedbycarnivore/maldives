import { describe, expect, test } from "vitest";
import { createFavoritesPanelController, favoritesPanelTitleForAction } from "../src/favorites-panel";

const complexEffectSource = `import { Effect, Layer, Schema, pipe } from "effect";

function sealed(_: unknown, _context: ClassDecoratorContext) {}

@sealed
class FavoriteStress<A extends { id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });

  run(id: string) {
    return Effect.gen(function* () {
      const value = yield* Effect.succeed({ id } as A);
      return pipe(value, Effect.succeed);
    });
  }
}

export const FavoriteLayer = Layer.succeed(FavoriteStress, new FavoriteStress());
`;

const context = {
  uri: "file:///workspace/effect-stress-app.tsx",
  source: complexEffectSource,
  lineNumber: 10,
  lineContent: "    return Effect.gen(function* () {",
};

describe("favorites parity panel", () => {
  test("adds the active real-code location to a visible favorites model", () => {
    const controller = createFavoritesPanelController();

    expect(favoritesPanelTitleForAction("AddToFavoritesPopup")).toBe("Add to Favorites");
    expect(controller.runAction("AddToFavoritesPopup", context)).toBe(true);

    const snapshot = controller.snapshot();
    expect(snapshot).toMatchObject({ title: "Add to Favorites", activeActionId: "AddToFavoritesPopup" });
    expect(snapshot?.items).toHaveLength(1);
    expect(snapshot?.items[0]).toMatchObject({
      uri: "file:///workspace/effect-stress-app.tsx",
      lineNumber: 10,
      label: "effect-stress-app.tsx:10",
      preview: "return Effect.gen(function* () {",
    });
    expect(snapshot?.details.join("\n")).toContain("Favorites: 1");
    expect(snapshot?.details.join("\n")).toContain("Complex file lines: 17");

    expect(controller.runAction("AddToFavoritesPopup", { ...context, lineNumber: 10 })).toBe(true);
    expect(controller.snapshot()?.items).toHaveLength(1);
    expect(controller.runAction("NotFavorites", context)).toBe(false);
  });
});
