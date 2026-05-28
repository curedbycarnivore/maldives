import type * as monaco from "monaco-editor";

export interface EffectHoverDoc {
  summary: string;
  example: string;
  url: string;
}

type MonacoApi = typeof monaco;
type QuickInfoDisplayPart = { text?: string };
type QuickInfo = { displayParts?: QuickInfoDisplayPart[]; textSpan?: { start: number; length: number } };
type TypeScriptWorker = { getQuickInfoAtPosition(fileName: string, offset: number): Promise<QuickInfo | undefined> };
type TypeScriptWorkerFactory = (uri: monaco.editor.ITextModel["uri"]) => Promise<TypeScriptWorker>;
type TypeScriptWithWorker = { getTypeScriptWorker?: () => Promise<TypeScriptWorkerFactory> };

export const EFFECT_HOVER_DOCS = {
  "Effect.gen": {
    summary: "Build an Effect by yielding other Effects in generator style.",
    example: "const program = Effect.gen(function* () {\n  const value = yield* Effect.succeed(1)\n  return value\n})",
    url: "https://effect.website/docs/getting-started/using-generators/",
  },
  "Effect.map": {
    summary: "Transform the success value of an Effect without changing its error or context.",
    example: "pipe(Effect.succeed(1), Effect.map((n) => n + 1))",
    url: "https://effect.website/docs/getting-started/using-generators/",
  },
  pipe: {
    summary: "Thread a value through a sequence of functions from left to right.",
    example: "pipe(value, Effect.map((n) => n + 1))",
    url: "https://effect.website/docs/code-style/pipeline/",
  },
  Layer: {
    summary: "Describe how services are constructed and provided to Effect programs.",
    example: "const Live = Layer.effect(Service, Effect.succeed(implementation))",
    url: "https://effect.website/docs/requirements-management/layers/",
  },
  Schema: {
    summary: "Define runtime schemas that derive validation, encoding, decoding, and JSON Schema.",
    example: "const User = Schema.Struct({ name: Schema.String })",
    url: "https://effect.website/docs/schema/introduction/",
  },
  Match: {
    summary: "Pattern match values with composable predicates and exhaustive fallbacks.",
    example: "Match.value(input).pipe(Match.when(\"ready\", () => true), Match.orElse(() => false))",
    url: "https://effect.website/docs/code-style/pattern-matching/",
  },
  Option: {
    summary: "Represent an optional value without using null or undefined.",
    example: "Option.match(option, { onNone: () => 0, onSome: (value) => value })",
    url: "https://effect.website/docs/data-types/option/",
  },
  Either: {
    summary: "Represent a value that is either a typed failure or a success.",
    example: "Either.match(result, { onLeft: handleError, onRight: handleValue })",
    url: "https://effect.website/docs/data-types/either/",
  },
  Schedule: {
    summary: "Describe recurrence, retry, and repetition policies for Effects.",
    example: "Effect.retry(program, Schedule.exponential(\"100 millis\"))",
    url: "https://effect.website/docs/scheduling/schedules/",
  },
  Stream: {
    summary: "Model effectful streams of values with resource safety and backpressure.",
    example: "Stream.fromIterable([1, 2, 3])",
    url: "https://effect.website/docs/stream/introduction/",
  },
  Fiber: {
    summary: "Represent a lightweight Effect runtime fiber that can be joined or interrupted.",
    example: "const fiber = yield* Effect.fork(program)\nyield* Fiber.interrupt(fiber)",
    url: "https://effect.website/docs/concurrency/fibers/",
  },
} as const satisfies Record<string, EffectHoverDoc>;

export type EffectHoverSymbol = keyof typeof EFFECT_HOVER_DOCS;

export function effectHoverDocForSymbol(symbol: string): EffectHoverDoc | undefined {
  return EFFECT_HOVER_DOCS[symbol as EffectHoverSymbol];
}

export function effectHoverSymbolFromQuickInfo(displayText: string): EffectHoverSymbol | undefined {
  const symbols = Object.keys(EFFECT_HOVER_DOCS).sort((left, right) => right.length - left.length) as EffectHoverSymbol[];

  return symbols.find((symbol) => displayText.includes(symbol));
}

export function registerEffectHoverProvider(monacoApi: MonacoApi): monaco.IDisposable {
  return monacoApi.languages.registerHoverProvider("typescript", {
    async provideHover(model, position) {
      const quickInfo = await quickInfoAtPosition(monacoApi, model, position);
      const symbol = quickInfo ? effectHoverSymbolFromQuickInfo(displayPartsToString(quickInfo.displayParts)) : undefined;
      const doc = symbol ? effectHoverDocForSymbol(symbol) : undefined;

      if (!doc) {
        return undefined;
      }

      return {
        range: quickInfo?.textSpan ? rangeForTextSpan(monacoApi, model, quickInfo.textSpan) : undefined,
        contents: [
          { value: `**${symbol}** — ${doc.summary}` },
          { value: `**Example**\n\n\`\`\`ts\n${doc.example}\n\`\`\`` },
          { value: `[Effect docs](${doc.url}) — ${doc.url}` },
        ],
      };
    },
  });
}

async function quickInfoAtPosition(
  monacoApi: MonacoApi,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): Promise<QuickInfo | undefined> {
  const getTypeScriptWorker = (monacoApi.languages.typescript as unknown as TypeScriptWithWorker).getTypeScriptWorker;

  if (!getTypeScriptWorker) {
    return undefined;
  }

  const getWorker = await getTypeScriptWorker();
  const worker = await getWorker(model.uri);
  return worker.getQuickInfoAtPosition(model.uri.toString(), model.getOffsetAt(position));
}

function displayPartsToString(parts: QuickInfoDisplayPart[] | undefined): string {
  return parts?.map((part) => part.text ?? "").join("") ?? "";
}

function rangeForTextSpan(
  monacoApi: MonacoApi,
  model: monaco.editor.ITextModel,
  textSpan: { start: number; length: number },
): monaco.Range {
  const start = model.getPositionAt(textSpan.start);
  const end = model.getPositionAt(textSpan.start + textSpan.length);
  return new monacoApi.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}
