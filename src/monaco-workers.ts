/// <reference types="vite/client" />

import type * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

type MonacoWorkerFactory = () => Worker;
type TypeScriptWorkerClient = {
  getQuickInfoAtPosition(fileName: string, offset: number): Promise<unknown>;
};
type TypeScriptWorkerFactory = (uri: monaco.Uri) => Promise<TypeScriptWorkerClient>;
type TypeScriptLanguageApi = {
  getTypeScriptWorker(): Promise<TypeScriptWorkerFactory>;
};

interface AwaitTypeScriptWorkerAnswerOptions {
  timeoutMs?: number;
  attemptTimeoutMs?: number;
}

const nextReadinessTick = () =>
  new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }

    globalThis.setTimeout(resolve, 0);
  });

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(`Timed out waiting for TypeScript worker answer after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

interface MonacoWorkerFactories {
  editorWorker: MonacoWorkerFactory;
  typeScriptWorker: MonacoWorkerFactory;
}

export function setupMonacoWorkers(factories: MonacoWorkerFactories): void {
  globalThis.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      if (label === "typescript" || label === "javascript") {
        return factories.typeScriptWorker();
      }

      return factories.editorWorker();
    },
  };
}

export function setupDefaultMonacoWorkers(): void {
  setupMonacoWorkers({
    editorWorker: () => new EditorWorker(),
    typeScriptWorker: () => new TypeScriptWorker(),
  });
}

export async function awaitTypeScriptWorkerAnswer(
  monacoApi: typeof monaco,
  model: monaco.editor.ITextModel,
  options: AwaitTypeScriptWorkerAnswerOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 60000;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? Math.min(10000, timeoutMs);
  const startedAt = Date.now();
  const typeScriptApi = monacoApi.languages.typescript as unknown as TypeScriptLanguageApi;

  for (;;) {
    try {
      const remainingMs = Math.max(1, timeoutMs - (Date.now() - startedAt));
      const deadlineMs = Math.min(attemptTimeoutMs, remainingMs);
      const getWorker = await withTimeout(typeScriptApi.getTypeScriptWorker(), deadlineMs);
      const worker = await withTimeout(getWorker(model.uri), deadlineMs);
      await withTimeout(
        worker.getQuickInfoAtPosition(model.uri.toString(), model.getOffsetAt({ lineNumber: 1, column: 1 })),
        deadlineMs,
      );
      return;
    } catch (error) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw error;
      }

      await nextReadinessTick();
    }
  }
}
