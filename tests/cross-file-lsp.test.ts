import { describe, expect, test, vi } from "vitest";
import { createWorkspaceTypeScriptMirror, definitionTargetFor } from "../src/cross-file-lsp";

describe("P31b cross-file LSP workspace sync", () => {
  test("mirrors every open workspace model into the TypeScript worker and disposes stale mirrors", () => {
    const disposals: string[] = [];
    const extraLibs: Array<{ content: string; filePath: string }> = [];
    const monaco = {
      typescript: {
        typescriptDefaults: {
          addExtraLib: vi.fn((content: string, filePath: string) => {
            extraLibs.push({ content, filePath });
            return { dispose: () => disposals.push(filePath) };
          }),
        },
      },
    };
    const workspace = fakeWorkspace([
      ["file:///p31b/src/repo.ts", "export class UserRepository {}"],
      ["file:///p31b/src/app.tsx", "import { UserRepository } from './repo';\nexport const app = new UserRepository();"],
    ]);

    const mirror = createWorkspaceTypeScriptMirror(monaco as never, workspace as never);
    mirror.sync();

    expect(extraLibs).toEqual([
      { filePath: "file:///p31b/src/repo.ts", content: "export class UserRepository {}" },
      { filePath: "file:///p31b/src/app.tsx", content: "import { UserRepository } from './repo';\nexport const app = new UserRepository();" },
    ]);

    workspace.replace("file:///p31b/src/repo.ts", "export class UserRepository { findAll() { return [] as const } }");
    mirror.sync();

    expect(disposals).toEqual(["file:///p31b/src/repo.ts", "file:///p31b/src/app.tsx"]);
    expect(extraLibs.at(-2)).toEqual({ filePath: "file:///p31b/src/repo.ts", content: "export class UserRepository { findAll() { return [] as const } }" });
    expect(extraLibs.at(-1)?.filePath).toBe("file:///p31b/src/app.tsx");
  });

  test("selects an open workspace model as the navigation target for a definition", () => {
    const repoModel = fakeModel("file:///p31b/src/repo.ts", "export class UserRepository {}\n");
    const workspace = fakeWorkspace([["file:///p31b/src/repo.ts", repoModel.getValue()]], { modelOverride: repoModel });

    const target = definitionTargetFor(
      [{ fileName: "file:///p31b/src/repo.ts", textSpan: { start: 13, length: 14 } }],
      workspace as never,
    );

    expect(target).toEqual({ uri: "file:///p31b/src/repo.ts", model: repoModel, offset: 13 });
  });
});

function fakeWorkspace(entries: Array<[string, string]>, options: { modelOverride?: ReturnType<typeof fakeModel> } = {}) {
  const files = new Map(entries);
  const models = new Map(entries.map(([uri, content]) => [uri, options.modelOverride ?? fakeModel(uri, content)]));

  return {
    uris: () => [...files.keys()],
    model: (uri: string) => models.get(uri),
    replace(uri: string, content: string) {
      files.set(uri, content);
      models.set(uri, fakeModel(uri, content));
    },
  };
}

function fakeModel(uri: string, content: string) {
  return {
    uri: { toString: () => uri },
    getValue: () => content,
    getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
  };
}
