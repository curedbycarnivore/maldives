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

  test("preserves try/catch structure while rewriting awaited promises", () => {
    const source = `async function guarded(): Promise<string> {
  try {
    return await fetchName();
  } catch (error) {
    return "fallback";
  }
}`;

    const result = convertPromiseFunctionToEffectGen(source, source.indexOf("fetchName"));

    expect(result).toContain("try {");
    expect(result).toContain("return yield* Effect.tryPromise(() => fetchName());");
    expect(result).toContain("} catch (error) {");
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
});
