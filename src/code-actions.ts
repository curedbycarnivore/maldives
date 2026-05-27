import type * as monaco from "monaco-editor";

const codeActions = [
  {
    title: "Extract selection (Maldives placeholder)",
    kind: "refactor.extract",
    edit: { edits: [] },
  },
  {
    title: "Organize imports (Maldives placeholder)",
    kind: "source.organizeImports",
    edit: { edits: [] },
  },
] satisfies monaco.languages.CodeAction[];

export function registerMaldivesCodeActions(monacoApi: typeof monaco): monaco.IDisposable {
  return monacoApi.languages.registerCodeActionProvider(
    "typescript",
    {
      provideCodeActions(_model, _range, context) {
        return {
          actions: codeActions.filter((action) => matchesRequestedKind(action.kind, context.only)),
          dispose() {},
        };
      },
    },
    { providedCodeActionKinds: codeActions.map((action) => action.kind) },
  );
}

function matchesRequestedKind(kind: string, requestedKind: string | undefined): boolean {
  return !requestedKind || kind === requestedKind || kind.startsWith(`${requestedKind}.`);
}
