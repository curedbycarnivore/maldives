import { describe, expect, test, vi } from "vitest";
import type * as monaco from "monaco-editor";
import { registerEffectSnippets } from "../src/effect-snippets";

const expectedSnippetLabels = [
  "eff-pipe",
  "eff-gen",
  "eff-match",
  "eff-tap",
  "eff-catchAll",
  "eff-catchTag",
  "eff-andThen",
  "eff-flatMap",
  "eff-mapError",
  "eff-runPromise",
  "eff-runSync",
  "eff-layer",
  "eff-context",
  "eff-service",
  "eff-schedule",
  "eff-fork",
  "eff-race",
  "opt-some",
  "opt-none",
  "opt-match",
  "eit-left",
  "eit-right",
  "eit-match",
] as const;

function monacoSnippetStub() {
  return {
    languages: {
      CompletionItemKind: { Snippet: 27 },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    Range: class {
      constructor(
        readonly startLineNumber: number,
        readonly startColumn: number,
        readonly endLineNumber: number,
        readonly endColumn: number,
      ) {}
    },
  } as unknown as typeof monaco;
}

describe("registerEffectSnippets", () => {
  test("registers the practical Effect power-user snippet canon", async () => {
    const monacoStub = monacoSnippetStub();

    registerEffectSnippets(monacoStub);

    expect(monacoStub.languages.registerCompletionItemProvider).toHaveBeenCalledWith("typescript", expect.any(Object));
    const provider = vi.mocked(monacoStub.languages.registerCompletionItemProvider).mock.calls[0]?.[1];
    expect(provider?.triggerCharacters).toEqual(["-"]);

    const completions = await Promise.resolve(
      provider?.provideCompletionItems(
        {
          getLineContent: () => "eff-catchAll",
          getWordUntilPosition: () => ({ startColumn: 5, endColumn: 13 }),
        } as monaco.editor.ITextModel,
        { lineNumber: 1, column: 13 } as monaco.Position,
        {} as monaco.languages.CompletionContext,
        {} as monaco.CancellationToken,
      ),
    );

    for (const label of expectedSnippetLabels) {
      expect(completions?.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label,
            kind: 27,
            insertText: expect.any(String),
            insertTextRules: 4,
            documentation: expect.stringContaining("https://effect.website/docs/"),
          }),
        ]),
      );
    }

    const catchAll = completions?.suggestions.find((suggestion) => suggestion.label === "eff-catchAll");
    expect(catchAll?.range).toMatchObject({ startColumn: 1, endColumn: 13 });
  });

  test("does not pollute ordinary TypeScript completions", async () => {
    const monacoStub = monacoSnippetStub();

    registerEffectSnippets(monacoStub);

    const provider = vi.mocked(monacoStub.languages.registerCompletionItemProvider).mock.calls[0]?.[1];
    const completions = await Promise.resolve(
      provider?.provideCompletionItems(
        {
          getLineContent: () => "Predicate.is",
          getWordUntilPosition: () => ({ startColumn: 11, endColumn: 13 }),
        } as monaco.editor.ITextModel,
        { lineNumber: 1, column: 13 } as monaco.Position,
        {} as monaco.languages.CompletionContext,
        {} as monaco.CancellationToken,
      ),
    );

    expect(completions?.suggestions).toEqual([]);
  });
});
