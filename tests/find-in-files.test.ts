import { describe, expect, test } from "vitest";
import { findInFiles } from "../src/find-in-files";
import { MemoryFileSystemAdapter } from "../src/fs/memory-adapter";

const complexEffectTsx = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function service(_: unknown, _context: ClassDecoratorContext) {}

@service
class AuditRepository<A extends { readonly id: string }> {
  constructor(readonly seed: A) {}

  load(id: string) {
    return Effect.gen(function* () {
      const parsed = Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))({ id });
      return { ...parsed, seed: this.seed };
    });
  }
}

export const AuditLayer = Layer.succeed(
  Context.GenericTag<AuditRepository<{ readonly id: string }>>("AuditRepository"),
  new AuditRepository({ id: "seed" }),
);

export const auditProgram = pipe(
  Effect.succeed("needle-user"),
  Effect.flatMap((id) => new AuditRepository({ id }).load(id)),
);
`;

describe("findInFiles", () => {
  test("recursively searches real adapter files and reports line, column, and preview", async () => {
    const adapter = new MemoryFileSystemAdapter({
      "/workspace/src/audit.tsx": complexEffectTsx,
      "/workspace/src/nested/readme.md": "No match here\n",
      "/workspace/test/audit.test.ts": "expect(auditProgram).toBeDefined();\n",
    });

    const results = await findInFiles(adapter, "auditProgram", { root: "/workspace" });

    expect(results).toEqual([
      {
        path: "/workspace/src/audit.tsx",
        lineNumber: 22,
        column: 14,
        preview: "export const auditProgram = pipe(",
      },
      {
        path: "/workspace/test/audit.test.ts",
        lineNumber: 1,
        column: 8,
        preview: "expect(auditProgram).toBeDefined();",
      },
    ]);
  });

  test("supports regex searches across project text files without returning directory pseudo-matches", async () => {
    const adapter = new MemoryFileSystemAdapter({
      "/workspace/src/audit.tsx": complexEffectTsx,
      "/workspace/src/schema.txt": "Schema.Struct is documented here too\n",
    });

    const results = await findInFiles(adapter, "Schema\\.Struct", { root: "/workspace", useRegex: true });

    expect(results).toEqual([
      {
        path: "/workspace/src/audit.tsx",
        lineNumber: 11,
        column: 47,
        preview: "const parsed = Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))({ id });",
      },
      {
        path: "/workspace/src/schema.txt",
        lineNumber: 1,
        column: 1,
        preview: "Schema.Struct is documented here too",
      },
    ]);
  });
});
