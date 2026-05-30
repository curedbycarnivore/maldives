import { describe, expect, test } from "vitest";
import { createTerminalPanelController, terminalPanelTitleForAction } from "../src/terminal-panel";

const complexEffectSource = `import { Effect, Layer, Schema, pipe } from "effect";

function sealed(_: unknown, _context: ClassDecoratorContext) {}

@sealed
class TerminalStress<A extends { id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });

  run(id: string) {
    return Effect.gen(function* () {
      const value = yield* Effect.succeed({ id } as A);
      return pipe(value, Effect.succeed);
    });
  }
}

export const TerminalLayer = Layer.succeed(TerminalStress, new TerminalStress());
`;

const context = {
  uri: "file:///workspace/effect-stress-app.tsx",
  source: complexEffectSource,
  lineNumber: 9,
  lineContent: "  run(id: string) {",
};

describe("terminal/task parity panel", () => {
  test("routes terminal and task actions into a real sandboxed panel", () => {
    const controller = createTerminalPanelController({ token: "session-token" });

    expect(terminalPanelTitleForAction("ActivateTerminalToolWindow")).toBe("Terminal");
    expect(controller.runAction("ActivateTerminalToolWindow", context)).toBe(true);
    expect(controller.snapshot()).toMatchObject({ visible: true, title: "Terminal", cwd: "/workspace" });

    expect(controller.execute("pwd", context, "session-token").ok).toBe(true);
    expect(controller.execute("echo Effect.gen Layer Schema", context, "session-token").output).toContain("Effect.gen Layer Schema");
    expect(controller.execute("cat effect-stress-app.tsx", context, "session-token").output).toContain("class TerminalStress");

    expect(controller.runAction("tasks.switch", context)).toBe(true);
    expect(controller.snapshot()?.lines.join("\n")).toContain("Task: typecheck");
    expect(controller.runAction("tasks.goto", context)).toBe(true);
    expect(controller.snapshot()?.lines.join("\n")).toContain("file:///workspace/effect-stress-app.tsx:9");
    expect(controller.runAction("tasks.open.in.browser", context)).toBe(true);
    expect(controller.snapshot()?.lines.join("\n")).toContain("Preview: http://127.0.0.1:5173/");

    expect(controller.runAction("tasks.close", context)).toBe(true);
    expect(controller.snapshot()?.visible).toBe(false);
    expect(controller.runAction("NotTerminal", context)).toBe(false);
  });

  test("enforces sandbox security gates and writes an audit trail", () => {
    const controller = createTerminalPanelController({ token: "session-token" });

    expect(controller.execute("pwd", context, "bad-token")).toMatchObject({ ok: false, output: "EACCES: invalid terminal token" });
    expect(controller.execute("cd ..", context, "session-token")).toMatchObject({ ok: false, output: "ESECURITY: path traversal denied" });
    expect(controller.execute("rm -rf /", context, "session-token")).toMatchObject({ ok: false, output: "ESECURITY: command not allowlisted" });

    controller.execute("ls", context, "session-token");
    expect(controller.auditLog()).toEqual([
      "DENY token command=pwd uri=file:///workspace/effect-stress-app.tsx",
      "DENY traversal command=cd uri=file:///workspace/effect-stress-app.tsx",
      "DENY command command=rm uri=file:///workspace/effect-stress-app.tsx",
      "ALLOW command=ls uri=file:///workspace/effect-stress-app.tsx",
    ]);
  });
});
