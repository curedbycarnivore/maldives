/// <reference types="vite/client" />

import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

type MonacoWorkerFactory = () => Worker;

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
