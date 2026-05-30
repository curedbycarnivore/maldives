import { describe, expect, test } from "vitest";
import { createRunDebugPanelController, runDebugPanelTitleForAction } from "../src/run-debug-panel";

const complexEffectSource = `import { Effect, Layer, Schema, pipe } from "effect";

function sealed(_: unknown, _context: ClassDecoratorContext) {}

@sealed
class StressRunner<A extends { id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });

  run(id: string) {
    return Effect.gen(function* () {
      const value = yield* Effect.succeed({ id } as A);
      return pipe(value, Effect.succeed);
    });
  }
}

export const StressLayer = Layer.succeed(StressRunner, new StressRunner());
`;

const context = {
  uri: "file:///workspace/effect-stress-app.tsx",
  source: complexEffectSource,
  lineNumber: 7,
  lineContent: "  run(id: string) {",
};

describe("run/debug parity panel", () => {
  test("routes WebStorm run/debug actions into executable lifecycle state", () => {
    const controller = createRunDebugPanelController();

    expect(runDebugPanelTitleForAction("Debug")).toBe("Debug");

    expect(controller.runAction("Run", context)).toBe(true);
    expect(controller.snapshot()).toMatchObject({ title: "Run", activeActionId: "Run", status: "running" });
    expect(controller.snapshot()?.details.join("\n")).toContain("Configuration: file:///workspace/effect-stress-app.tsx");
    expect(controller.snapshot()?.details.join("\n")).toContain("Target: StressRunner");

    expect(controller.runAction("DebugClass", context)).toBe(true);
    expect(controller.snapshot()).toMatchObject({ title: "Debug Class", activeActionId: "DebugClass", status: "debugging" });
    expect(controller.snapshot()?.details.join("\n")).toContain("Debugger attached to StressRunner");

    expect(controller.runAction("Resume", context)).toBe(true);
    expect(controller.snapshot()).toMatchObject({ title: "Resume", status: "running" });
    expect(controller.snapshot()?.details.join("\n")).toContain("Resumed StressRunner");

    expect(controller.runAction("Rerun", context)).toBe(true);
    expect(controller.snapshot()?.details.join("\n")).toContain("Rerun count: 2");

    expect(controller.runAction("Stop", context)).toBe(true);
    expect(controller.snapshot()).toMatchObject({ title: "Stop", status: "stopped" });

    expect(controller.runAction("NotARunAction", context)).toBe(false);
  });
});
