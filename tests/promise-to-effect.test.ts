import * as ts from "typescript";
import { describe, expect, test } from "vitest";
import { convertPromiseFunctionToEffectGen } from "../src/effect-refactor";

describe("convertPromiseFunctionToEffectGen", () => {
  test("converts a single-await async function to Effect.gen", () => {
    const source = `async function loadName(): Promise<string> {
  const name = await fetchName();
  return name;
}`;

    const result = convertPromiseFunctionToEffectGen(source, source.indexOf("fetchName"));

    expect(result).toContain('import { Effect } from "effect";');
    expect(result).toContain("function loadName(): Effect.Effect<string> {");
    expect(result).toContain("return Effect.gen(function*() {");
    expect(result).toContain("const name = yield* Effect.tryPromise(() => fetchName());");
    expect(result).toContain("return name;");
  });

  test("converts every await in a multi-await function", () => {
    const source = `import { Effect } from "effect";
async function loadBoth(): Promise<number> {
  const one = await first();
  const two = await second(one);
  return two;
}`;

    const result = convertPromiseFunctionToEffectGen(source, source.indexOf("second"));

    expect(result?.match(/Effect\.tryPromise/g)).toHaveLength(2);
    expect(result).toContain("const one = yield* Effect.tryPromise(() => first());");
    expect(result).toContain("const two = yield* Effect.tryPromise(() => second(one));");
  });

  test("does not offer a try/catch refactor because Promise rejection and Effect failure semantics differ", () => {
    const source = `async function guarded(): Promise<string> {
  try {
    return await fetchName();
  } catch (error) {
    return "fallback";
  }
}`;

    expect(convertPromiseFunctionToEffectGen(source, source.indexOf("fetchName"))).toBeUndefined();
  });

  test("rewrites awaited promises inside conditional branches", () => {
    const source = `async function maybeLoad(flag: boolean): Promise<string> {
  if (flag) {
    return await fetchName();
  }
  return "none";
}`;

    const result = convertPromiseFunctionToEffectGen(source, source.indexOf("flag"));

    expect(result).toContain("if (flag) {");
    expect(result).toContain("return yield* Effect.tryPromise(() => fetchName());");
    expect(result).toContain('return "none";');
  });

  test("does not offer a refactor for async functions without await", () => {
    const source = `async function alreadySync(): Promise<number> {
  return 1;
}`;

    expect(convertPromiseFunctionToEffectGen(source, source.indexOf("return"))).toBeUndefined();
  });

  test.each([
    {
      name: "simple try/catch",
      source: `async function guarded(): Promise<string> {
  try {
    return await fetchName();
  } catch (error) {
    return "fallback";
  }
}`,
      needle: "fetchName",
    },
    {
      name: "nested try/catch",
      source: `async function guarded(): Promise<string> {
  try {
    try {
      return await fetchName();
    } catch (inner) {
      return "inner";
    }
  } catch (outer) {
    return "outer";
  }
}`,
      needle: "fetchName",
    },
    {
      name: "await in async callback",
      source: `async function loadAll(ids: string[]): Promise<string[]> {
  return ids.map(async (id) => await fetchName(id));
}`,
      needle: "fetchName",
    },
    {
      name: "await in conditional expression",
      source: `async function choose(flag: boolean): Promise<string> {
  const name = flag ? await first() : await second();
  return name;
}`,
      needle: "first",
    },
    {
      name: "nested await inside awaited call",
      source: `async function nested(): Promise<string> {
  return await fetchName(await fetchId());
}`,
      needle: "fetchName",
    },
    {
      name: "nested await inside awaited initializer",
      source: `async function nested(): Promise<string> {
  const name = await fetchName(await fetchId());
  return name;
}`,
      needle: "fetchName",
    },
    {
      name: "await in spread",
      source: `async function spread(): Promise<string[]> {
  const names = [...await loadNames()];
  return names;
}`,
      needle: "loadNames",
    },
    {
      name: "await using this binding",
      source: `class Repository {
  async load(): Promise<string> {
    return await this.fetchName();
  }
  fetchName(): Promise<string> { return Promise.resolve("Ada"); }
}`,
      needle: "fetchName",
    },
    {
      name: "await using super binding",
      source: `class Base { fetchName(): Promise<string> { return Promise.resolve("Ada"); } }
class Repository extends Base {
  async load(): Promise<string> {
    return await super.fetchName();
  }
}`,
      needle: "super.fetchName",
    },
    {
      name: "await with arguments binding",
      source: `async function load(): Promise<string> {
  const name = await fetchName(arguments[0]);
  return name;
}`,
      needle: "fetchName",
    },
    {
      name: "await on number literal",
      source: `async function literal(): Promise<number> {
  const value = await 1;
  return value;
}`,
      needle: "1",
    },
    {
      name: "await on string literal",
      source: `async function literal(): Promise<string> {
  const value = await "cached";
  return value;
}`,
      needle: "cached",
    },
    {
      name: "await on boolean literal",
      source: `async function literal(): Promise<boolean> {
  const value = await true;
  return value;
}`,
      needle: "true",
    },
    {
      name: "await on array literal",
      source: `async function literal(): Promise<unknown[]> {
  const value = await [];
  return value;
}`,
      needle: "[]",
    },
    {
      name: "await on object literal",
      source: `async function literal(): Promise<object> {
  const value = await {};
  return value;
}`,
      needle: "{}",
    },
    {
      name: "await on non-promise identifier",
      source: `async function cached(): Promise<number> {
  const local = 1;
  const value = await local;
  return value;
}`,
      needle: "local;",
    },
    {
      name: "await in object literal property",
      source: `async function objectValue(): Promise<{ name: string }> {
  return { name: await fetchName() };
}`,
      needle: "fetchName",
    },
    {
      name: "await in array literal",
      source: `async function arrayValue(): Promise<string[]> {
  return [await fetchName()];
}`,
      needle: "fetchName",
    },
    {
      name: "await in binary expression",
      source: `async function count(): Promise<number> {
  return (await fetchCount()) + 1;
}`,
      needle: "fetchCount",
    },
  ])("hides the action for unsafe shape: $name", ({ source, needle }) => {
    expect(convertPromiseFunctionToEffectGen(source, source.indexOf(needle))).toBeUndefined();
  });

  test.each([
    {
      name: "function declaration",
      source: `declare function fetchName(): Promise<string>;
async function loadName(): Promise<string> {
  const name = await fetchName();
  return name;
}`,
      needle: "fetchName()",
    },
    {
      name: "multi-await function",
      source: `declare function first(): Promise<number>;
declare function second(value: number): Promise<number>;
async function loadBoth(): Promise<number> {
  const one = await first();
  const two = await second(one);
  return two;
}`,
      needle: "second(one)",
    },
    {
      name: "arrow function block",
      source: `declare function fetchName(): Promise<string>;
const loadName = async (): Promise<string> => {
  const name = await fetchName();
  return name;
};`,
      needle: "fetchName()",
    },
    {
      name: "class method",
      source: `declare function fetchName(id: string): Promise<string>;
class Repository<T extends { id: string }> {
  async load(entity: T): Promise<string> {
    const name = await fetchName(entity.id);
    return name;
  }
}`,
      needle: "fetchName",
    },
    {
      name: "conditional branch returns",
      source: `declare function fetchName(): Promise<string>;
async function maybeLoad(flag: boolean): Promise<string> {
  if (flag) {
    return await fetchName();
  }
  return "fallback";
}`,
      needle: "fetchName",
    },
  ])("emits TypeScript-valid code for $name", ({ source, needle }) => {
    const result = convertPromiseFunctionToEffectGen(source, source.lastIndexOf(needle));

    expect(result).toBeDefined();
    expect(expectTypeScriptDiagnostics(result ?? "")).toEqual([]);
  });
});

function expectTypeScriptDiagnostics(source: string): string[] {
  const effectDts = `declare module "effect" {
  export namespace Effect {
    export interface Effect<A = unknown, E = unknown, R = unknown> extends Generator<unknown, A, unknown> {}
    export function tryPromise<A>(thunk: () => Promise<A>): Effect<A, unknown, never>;
    export function gen<A>(body: () => Generator<unknown, A, unknown>): Effect<A, unknown, never>;
  }
}`;
  const files = new Map([
    ["/maldives.ts", source],
    ["/effect.d.ts", effectDts],
  ]);
  const options: ts.CompilerOptions = {
    baseUrl: "/",
    ignoreDeprecations: "6.0",
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    paths: { effect: ["/effect.d.ts"] },
    strict: true,
    target: ts.ScriptTarget.ESNext,
  };
  const defaultHost = ts.createCompilerHost(options);
  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (fileName) => files.has(fileName) || defaultHost.fileExists(fileName),
    readFile: (fileName) => files.get(fileName) ?? defaultHost.readFile(fileName),
    getSourceFile: (fileName, languageVersion) => {
      const text = files.get(fileName) ?? defaultHost.readFile(fileName);
      return text === undefined ? undefined : ts.createSourceFile(fileName, text, languageVersion, true);
    },
  };
  const program = ts.createProgram(["/maldives.ts", "/effect.d.ts"], options, host);

  return ts.getPreEmitDiagnostics(program).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}
