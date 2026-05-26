import { describe, expect, test, vi } from "vitest";
import type * as monaco from "monaco-editor";
import { registerEffectSnippets } from "../src/effect-snippets";

describe("registerEffectSnippets", () => {
  test("registers Effect snippets for TypeScript completions", async () => {
    const monacoStub = {
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

    registerEffectSnippets(monacoStub);

    expect(monacoStub.languages.registerCompletionItemProvider).toHaveBeenCalledWith("typescript", expect.any(Object));
    const provider = vi.mocked(monacoStub.languages.registerCompletionItemProvider).mock.calls[0]?.[1];
    expect(provider?.triggerCharacters).toEqual(["-"]);

    const completions = await Promise.resolve(
      provider?.provideCompletionItems(
        { getWordUntilPosition: () => ({ startColumn: 1, endColumn: 5 }) } as monaco.editor.ITextModel,
        { lineNumber: 1, column: 5 } as monaco.Position,
        {} as monaco.languages.CompletionContext,
        {} as monaco.CancellationToken,
      ),
    );

    expect(completions?.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "eff-pipe", kind: 27, insertTextRules: 4 }),
        expect.objectContaining({ label: "eff-gen", kind: 27, insertTextRules: 4 }),
        expect.objectContaining({ label: "eff-match", kind: 27, insertTextRules: 4 }),
      ]),
    );
  });
});
