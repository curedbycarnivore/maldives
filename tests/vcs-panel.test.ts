import { describe, expect, test } from "vitest";
import { createVcsPanelController, vcsPanelTitleForAction } from "../src/vcs-panel";

const complexEffectSource = `import { Effect, Layer, Schema, pipe } from "effect";

class AuditRepo<A extends { id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  load(id: string) {
    return Effect.gen(function* () {
      return yield* Effect.succeed({ id } as A);
    });
  }
}

export const RepoLive = Layer.succeed(AuditRepo, new AuditRepo());
`;

describe("VCS parity panel", () => {
  test("routes WebStorm VCS actions into real panel state", () => {
    const controller = createVcsPanelController();
    const context = {
      uri: "file:///workspace/effect-stress-app.tsx",
      source: complexEffectSource,
      lineNumber: 5,
      lineContent: "  load(id: string) {",
    };

    expect(vcsPanelTitleForAction("Git.Branches")).toBe("Branches");

    expect(controller.runAction("Annotate", context)).toBe(true);
    expect(controller.snapshot()).toMatchObject({ title: "Annotate", activeActionId: "Annotate" });
    expect(controller.snapshot()?.details.join("\n")).toContain("Line 5: load(id: string) {");

    expect(controller.runAction("ChangesView.AddUnversioned", context)).toBe(true);
    expect(controller.snapshot()?.details.join("\n")).toContain("Tracked file: file:///workspace/effect-stress-app.tsx");

    expect(controller.runAction("ChangesView.ShelveSilently", context)).toBe(true);
    expect(controller.snapshot()?.details.join("\n")).toContain(`Shelved ${complexEffectSource.trimEnd().split(/\r?\n/).length} lines from file:///workspace/effect-stress-app.tsx`);

    expect(controller.runAction("Diff.NextChange", context)).toBe(true);
    expect(controller.snapshot()?.details.join("\n")).toContain("Selected change 1/3");

    expect(controller.runAction("Diff.NextConflict", context)).toBe(true);
    expect(controller.snapshot()?.details.join("\n")).toContain("Selected conflict 1/2");

    expect(controller.runAction("NotAVcsAction", context)).toBe(false);
  });
});
