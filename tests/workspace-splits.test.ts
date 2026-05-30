import { describe, expect, test, vi } from "vitest";
import { MaldivesWorkspace } from "../src/workspace";

interface FakeModel {
  uri: { toString: () => string };
  onDidChangeContent: (listener: () => void) => { dispose: () => void };
  dispose: () => void;
}

describe("MaldivesWorkspace split layout", () => {
  test("splits the active model right/down and reorders panes", () => {
    const editor = { setModel: vi.fn(), updateOptions: vi.fn(), focus: vi.fn() };
    const workspace = new MaldivesWorkspace({
      editor: editor as never,
      createModel: (uri: string) => fakeModel(uri) as never,
    });

    workspace.open("file:///p16b/app.tsx", complexEffectSource("App"));
    workspace.open("file:///p16b/repo.ts", complexEffectSource("Repo"));

    expect(workspace.panes()).toEqual([{ id: "pane-1", uri: "file:///p16b/repo.ts", direction: "root" }]);

    const right = workspace.splitRight("file:///p16b/app.tsx");
    expect(right).toMatchObject({ id: "pane-2", uri: "file:///p16b/app.tsx", direction: "right" });
    expect(workspace.activeUri).toBe("file:///p16b/app.tsx");

    const down = workspace.splitDown("file:///p16b/repo.ts");
    expect(down).toMatchObject({ id: "pane-3", uri: "file:///p16b/repo.ts", direction: "down" });
    expect(workspace.panes().map((pane) => `${pane.direction}:${pane.uri}`)).toEqual([
      "root:file:///p16b/repo.ts",
      "right:file:///p16b/app.tsx",
      "down:file:///p16b/repo.ts",
    ]);

    expect(workspace.movePane("pane-3", 0)).toBe(true);
    expect(workspace.panes().map((pane) => pane.id)).toEqual(["pane-3", "pane-1", "pane-2"]);
    expect(workspace.movePane("missing", 1)).toBe(false);
  });
});

function fakeModel(uri: string): FakeModel {
  return {
    uri: { toString: () => uri },
    onDidChangeContent: () => ({ dispose: () => undefined }),
    dispose: () => undefined,
  };
}

function complexEffectSource(name: string): string {
  return `import { Effect, Layer, Schema, pipe } from "effect";

function Injectable(): ClassDecorator { return () => undefined; }

@Injectable()
export class P16BSplit${name}<A extends { readonly id: string }> {
  readonly schema = Schema.Struct({ id: Schema.String });
  readonly program = pipe(
    Effect.gen(function* () {
      const value = yield* Effect.succeed({ id: "${name.toLowerCase()}" } as A);
      return this.schema.make({ id: value.id });
    }),
    Effect.provide(Layer.empty),
  );
}
`;
}
