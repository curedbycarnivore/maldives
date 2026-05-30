import { describe, expect, test, vi } from "vitest";
import { createEffectTsgoDiagnosticsClient, effectTsgoDiagnosticsToMarkers } from "../src/effect-tsgo-client";

const complexSource = `import { Effect, Layer, Schema, pipe } from "effect";

function injectable(_: unknown, _context: ClassDecoratorContext) {}

@injectable
class P28cService<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  load(id: string) {
    Effect.succeed(id);
    return pipe(id, Effect.succeed);
  }
}

export const Live = Layer.succeed("P28cService", new P28cService());
`;

describe("P28c Effect tsgo diagnostics client", () => {
  test("maps tsgo bridge diagnostics to Monaco marker data without off-by-one range changes", () => {
    expect(effectTsgoDiagnosticsToMarkers([
      {
        path: "/src/p28c.tsx",
        severity: "error",
        code: "TS9999",
        rule: "floatingEffect",
        startLine: 9,
        startCol: 5,
        endLine: 9,
        endCol: 18,
        message: "Effect is neither yielded nor used",
      },
      {
        path: "/src/p28c.tsx",
        severity: "warning",
        code: "TS2777",
        rule: "missingEffectError",
        startLine: 14,
        startCol: 12,
        endLine: 14,
        endCol: 21,
        message: "Missing error channel",
      },
    ], { error: 8, warning: 4 })).toEqual([
      {
        severity: 8,
        code: "floatingEffect",
        source: "effect-tsgo",
        startLineNumber: 9,
        startColumn: 5,
        endLineNumber: 9,
        endColumn: 18,
        message: "Effect is neither yielded nor used",
      },
      {
        severity: 4,
        code: "missingEffectError",
        source: "effect-tsgo",
        startLineNumber: 14,
        startColumn: 12,
        endLineNumber: 14,
        endColumn: 21,
        message: "Missing error channel",
      },
    ]);
  });

  test("POSTs the active model path/content and applies returned effect-tsgo markers", async () => {
    const setModelMarkers = vi.fn();
    const getModelMarkers = vi.fn(() => [
      {
        source: "effect-tsgo",
        code: "floatingEffect",
        startLineNumber: 9,
        startColumn: 5,
        endLineNumber: 9,
        endColumn: 18,
        message: "Effect is neither yielded nor used",
      },
    ]);
    const fetch = vi.fn(async (_endpoint: string, _init: RequestInit) => new Response(JSON.stringify({
      diagnostics: [
        {
          path: "/src/p28c.tsx",
          severity: "error",
          code: "TS9999",
          rule: "floatingEffect",
          startLine: 9,
          startCol: 5,
          endLine: 9,
          endCol: 18,
          message: "Effect is neither yielded nor used",
        },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const model = {
      uri: { path: "/src/p28c.tsx", toString: () => "file:///src/p28c.tsx" },
      getValue: () => complexSource,
    };

    const client = createEffectTsgoDiagnosticsClient({
      monaco: { MarkerSeverity: { Error: 8, Warning: 4 }, editor: { setModelMarkers, getModelMarkers } },
      fetch,
      endpoint: "/__maldives/effect-tsgo/diagnostics",
    });

    await client.refreshModel(model);

    expect(fetch).toHaveBeenCalledWith("/__maldives/effect-tsgo/diagnostics", expect.objectContaining({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/src/p28c.tsx", content: complexSource }),
    }));
    expect(setModelMarkers).toHaveBeenCalledWith(model, "effect-tsgo", [expect.objectContaining({
      source: "effect-tsgo",
      code: "floatingEffect",
      startLineNumber: 9,
      startColumn: 5,
      endLineNumber: 9,
      endColumn: 18,
    })]);
    expect(client.getRenderedDiagnostics(model)).toEqual([
      {
        rule: "floatingEffect",
        startLine: 9,
        startCol: 5,
        endLine: 9,
        endCol: 18,
        message: "Effect is neither yielded nor used",
      },
    ]);
  });
});
