import { describe, expect, test, vi } from "vitest";
import type * as monaco from "monaco-editor";
import { awaitTypeScriptWorkerAnswer, setupMonacoWorkers } from "../src/monaco-workers";

describe("awaitTypeScriptWorkerAnswer", () => {
  test("retries until Monaco registers the TypeScript language contribution", async () => {
    let attempts = 0;
    const model = {
      uri: { toString: () => "file:///maldives/sample.ts" },
      getOffsetAt: () => 0,
    } as unknown as monaco.editor.ITextModel;
    const monacoStub = {
      languages: {
        typescript: {
          async getTypeScriptWorker() {
            attempts += 1;
            if (attempts < 3) {
              throw new Error("TypeScript not registered!");
            }

            return async () => ({
              async getQuickInfoAtPosition() {},
            });
          },
        },
      },
    } as unknown as typeof monaco;

    await awaitTypeScriptWorkerAnswer(monacoStub, model);

    expect(attempts).toBe(3);
  });

  test("uses the whole readiness deadline for the in-flight worker answer", async () => {
    let quickInfoCalls = 0;
    const model = {
      uri: { toString: () => "file:///maldives/sample.ts" },
      getOffsetAt: () => 0,
    } as unknown as monaco.editor.ITextModel;
    const monacoStub = {
      languages: {
        typescript: {
          async getTypeScriptWorker() {
            return async () => ({
              async getQuickInfoAtPosition() {
                quickInfoCalls += 1;
                await new Promise((resolve) => setTimeout(resolve, 20));
              },
            });
          },
        },
      },
    } as unknown as typeof monaco;

    await awaitTypeScriptWorkerAnswer(monacoStub, model, { timeoutMs: 100, attemptTimeoutMs: 5 });

    expect(quickInfoCalls).toBe(1);
  });

  test("does not enqueue duplicate quick info requests while the worker is already answering", async () => {
    let quickInfoCalls = 0;
    let resolveQuickInfo: (() => void) | undefined;
    const model = {
      uri: { toString: () => "file:///maldives/sample.ts" },
      getOffsetAt: () => 0,
    } as unknown as monaco.editor.ITextModel;
    const monacoStub = {
      languages: {
        typescript: {
          async getTypeScriptWorker() {
            return async () => ({
              getQuickInfoAtPosition() {
                quickInfoCalls += 1;
                return new Promise<void>((resolve) => {
                  resolveQuickInfo = resolve;
                });
              },
            });
          },
        },
      },
    } as unknown as typeof monaco;

    const ready = awaitTypeScriptWorkerAnswer(monacoStub, model, { timeoutMs: 100, attemptTimeoutMs: 5 });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(quickInfoCalls).toBe(1);
    resolveQuickInfo?.();
    await ready;
  });

  test("resolves only after the TypeScript worker answers for the attached model", async () => {
    const calls: string[] = [];
    const model = {
      uri: { toString: () => "file:///maldives/sample.ts" },
      getOffsetAt: () => 0,
    } as unknown as monaco.editor.ITextModel;
    const monacoStub = {
      languages: {
        typescript: {
          async getTypeScriptWorker() {
            calls.push("get-worker-factory");
            return async (uri: monaco.Uri) => {
              calls.push(`get-worker:${uri.toString()}`);
              return {
                async getQuickInfoAtPosition(path: string, offset: number) {
                  calls.push(`quick-info:${path}:${offset}`);
                },
              };
            };
          },
        },
      },
      Position: class {
        constructor(public lineNumber: number, public column: number) {}
      },
    } as unknown as typeof monaco;

    await awaitTypeScriptWorkerAnswer(monacoStub, model);

    expect(calls).toEqual([
      "get-worker-factory",
      "get-worker:file:///maldives/sample.ts",
      "quick-info:file:///maldives/sample.ts:0",
    ]);
  });
});

describe("setupMonacoWorkers", () => {
  test("routes TypeScript and JavaScript models to Monaco's TS worker", () => {
    const editorWorker = vi.fn(() => ({ kind: "editor" }) as unknown as Worker);
    const typeScriptWorker = vi.fn(() => ({ kind: "typescript" }) as unknown as Worker);

    setupMonacoWorkers({ editorWorker, typeScriptWorker });

    const environment = globalThis.MonacoEnvironment;
    expect(environment).toBeDefined();
    expect(environment!.getWorker("module", "typescript")).toEqual({ kind: "typescript" });
    expect(environment!.getWorker("module", "javascript")).toEqual({ kind: "typescript" });
    expect(environment!.getWorker("module", "editorWorkerService")).toEqual({ kind: "editor" });
    expect(typeScriptWorker).toHaveBeenCalledTimes(2);
    expect(editorWorker).toHaveBeenCalledTimes(1);
  });
});
