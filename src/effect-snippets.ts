import type * as monaco from "monaco-editor";

const effectSnippets = [
  {
    label: "eff-pipe",
    insertText: "pipe(\n\t${1:value},\n\t${2:Effect.map((${3:value}) => ${3:value})}\n)",
    documentation: "Create an Effect pipe expression.",
  },
  {
    label: "eff-gen",
    insertText: "Effect.gen(function* () {\n\t${1:const value = yield* ${2:effect}}\n\treturn ${3:value}\n})",
    documentation: "Create an Effect.gen block.",
  },
  {
    label: "eff-match",
    insertText:
      "Match.value(${1:value}).pipe(\n\tMatch.when(${2:predicate}, (${3:value}) => ${4:result}),\n\tMatch.orElse(() => ${5:fallback})\n)",
    documentation: "Create an Effect Match expression.",
  },
] as const;

export function registerEffectSnippets(monacoApi: typeof monaco): monaco.IDisposable {
  return monacoApi.languages.registerCompletionItemProvider("typescript", {
    triggerCharacters: ["-"],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monacoApi.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      );

      return {
        suggestions: effectSnippets.map((snippet) => ({
          label: snippet.label,
          kind: monacoApi.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.documentation,
          sortText: `0-${snippet.label}`,
          filterText: snippet.label,
          range,
        })),
      };
    },
  });
}
