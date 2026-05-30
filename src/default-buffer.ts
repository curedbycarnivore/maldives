export const DEFAULT_SAMPLE_URI = "file:///maldives/sample.tsx";

export const defaultSampleDocument = `import { Context, Effect, Layer, Schema, pipe } from "effect";

function Injectable(): ClassDecorator {
  return () => undefined;
}

@Injectable()
class XMLParser<T extends { readonly raw: string }> {
  readonly wordSchema = Schema.Struct({ raw: Schema.String });
  readonly serviceTag = Context.GenericTag<XMLParser<T>>("maldives/XMLParser");

  parse(word123: number, input: T) {
    const camelCaseWord = input.raw;
    let snake_case = word123;
    return pipe(
      Effect.gen(function* () {
        const parsed = yield* Effect.succeed(camelCaseWord.toUpperCase());
        return parsed + snake_case + word123;
      }),
      Effect.map((value) => ({ value, layer: Layer.empty })),
    );
  }
}

interface ParserEnv {
  readonly readonlyMode: boolean;
  readonly source: "default-buffer";
}

type ParserResult = {
  readonly result: string;
  readonly parserLayer: Layer.Layer<XMLParser<{ readonly raw: string }>>;
  readonly env: ParserEnv;
};

const parser = new XMLParser<{ readonly raw: string }>();
const parserLayer = Layer.succeed(parser.serviceTag, parser);

export const parserProgram = Effect.gen(function* () {
  const parsed = yield* parser.parse(7, { raw: "camelCaseWord" });
  return {
    result: parsed.value,
    parserLayer,
    env: { readonlyMode: true, source: "default-buffer" },
  } satisfies ParserResult;
});
`;
