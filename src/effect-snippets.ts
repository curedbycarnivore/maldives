import type * as monaco from "monaco-editor";

type EffectSnippet = {
  label: string;
  insertText: string;
  documentation: string;
};

const doc = (summary: string, path: string) => `${summary} Docs: https://effect.website/docs/${path}`;

const effectSnippets: readonly EffectSnippet[] = [
  { label: "eff-pipe", insertText: "pipe(\n\t${1:value},\n\t${2:Effect.map((${3:value}) => ${3:value})}\n)", documentation: doc("Create an Effect pipe expression.", "getting-started/using-generators/") },
  { label: "eff-gen", insertText: "Effect.gen(function* () {\n\t${1:const value = yield* ${2:effect}}\n\treturn ${3:value}\n})", documentation: doc("Create an Effect.gen block.", "getting-started/using-generators/") },
  { label: "eff-match", insertText: "Match.value(${1:value}).pipe(\n\tMatch.when(${2:predicate}, (${3:value}) => ${4:result}),\n\tMatch.orElse(() => ${5:fallback})\n)", documentation: doc("Create an Effect Match expression.", "code-style/pattern-matching/") },
  { label: "eff-tap", insertText: "Effect.tap((${1:value}) => ${2:effect})", documentation: doc("Run an effect without changing the success value.", "getting-started/using-generators/") },
  { label: "eff-catchAll", insertText: "Effect.catchAll((${1:error}) => ${2:handler})", documentation: doc("Recover from any expected error.", "error-management/expected-errors/") },
  { label: "eff-catchTag", insertText: "Effect.catchTag(\"${1:Tag}\", (${2:error}) => ${3:handler})", documentation: doc("Recover from a tagged expected error.", "error-management/expected-errors/") },
  { label: "eff-andThen", insertText: "Effect.andThen(${1:next})", documentation: doc("Sequence the next Effect operation.", "getting-started/using-generators/") },
  { label: "eff-flatMap", insertText: "Effect.flatMap((${1:value}) => ${2:next})", documentation: doc("Sequence an Effect using the previous value.", "getting-started/using-generators/") },
  { label: "eff-mapError", insertText: "Effect.mapError((${1:error}) => ${2:mappedError})", documentation: doc("Transform the error channel.", "error-management/expected-errors/") },
  { label: "eff-runPromise", insertText: "Effect.runPromise(${1:effect})", documentation: doc("Run an Effect as a Promise.", "running-effects/") },
  { label: "eff-runSync", insertText: "Effect.runSync(${1:effect})", documentation: doc("Run a synchronous Effect.", "running-effects/") },
  { label: "eff-layer", insertText: "Layer.effect(${1:Service}, ${2:effect})", documentation: doc("Build a Layer from an Effect.", "requirements-management/layers/") },
  { label: "eff-context", insertText: "Context.GenericTag<${1:Service}>(\"${2:Service}\")", documentation: doc("Create a Context tag.", "requirements-management/services/") },
  { label: "eff-service", insertText: "class ${1:Service} extends Context.Tag(\"${1:Service}\")<${1:Service}, ${2:Shape}>() {}", documentation: doc("Declare a class-based Effect service tag.", "requirements-management/services/") },
  { label: "eff-schedule", insertText: "Schedule.exponential(\"${1:100 millis}\")", documentation: doc("Create a retry/repetition schedule.", "scheduling/schedules/") },
  { label: "eff-fork", insertText: "Effect.fork(${1:effect})", documentation: doc("Fork an Effect into a fiber.", "concurrency/basic-concurrency/") },
  { label: "eff-race", insertText: "Effect.race(${1:left}, ${2:right})", documentation: doc("Race two Effects.", "concurrency/basic-concurrency/") },
  { label: "opt-some", insertText: "Option.some(${1:value})", documentation: doc("Construct an Option with a value.", "data-types/option/") },
  { label: "opt-none", insertText: "Option.none()", documentation: doc("Construct an empty Option.", "data-types/option/") },
  { label: "opt-match", insertText: "Option.match({\n\tonNone: () => ${1:none},\n\tonSome: (${2:value}) => ${3:some}\n})", documentation: doc("Pattern match on an Option.", "data-types/option/") },
  { label: "eit-left", insertText: "Either.left(${1:error})", documentation: doc("Construct a Left Either.", "data-types/either/") },
  { label: "eit-right", insertText: "Either.right(${1:value})", documentation: doc("Construct a Right Either.", "data-types/either/") },
  { label: "eit-match", insertText: "Either.match({\n\tonLeft: (${1:left}) => ${2:leftResult},\n\tonRight: (${3:right}) => ${4:rightResult}\n})", documentation: doc("Pattern match on an Either.", "data-types/either/") },
] as const;

function completionPrefix(model: monaco.editor.ITextModel, position: monaco.Position): string {
  const beforeCursor = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  return /[A-Za-z0-9_-]+$/.exec(beforeCursor)?.[0] ?? "";
}

function completionRange(monacoApi: typeof monaco, position: monaco.Position, prefix: string): monaco.Range {
  return new monacoApi.Range(position.lineNumber, position.column - prefix.length, position.lineNumber, position.column);
}

export function registerEffectSnippets(monacoApi: typeof monaco): monaco.IDisposable {
  return monacoApi.languages.registerCompletionItemProvider("typescript", {
    triggerCharacters: ["-"],
    provideCompletionItems(model, position) {
      const prefix = completionPrefix(model, position);

      if (!prefix.startsWith("eff-") && !prefix.startsWith("opt-") && !prefix.startsWith("eit-")) {
        return { suggestions: [] };
      }

      const range = completionRange(monacoApi, position, prefix);

      return {
        suggestions: effectSnippets.map((snippet) => ({
          label: snippet.label,
          kind: monacoApi.languages.CompletionItemKind.Snippet,
          insertText: snippet.insertText,
          insertTextRules: monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: snippet.documentation,
          detail: "Effect-TS snippet",
          sortText: `0-${snippet.label}`,
          filterText: snippet.label,
          range,
        })),
      };
    },
  });
}
