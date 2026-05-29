import { describe, expect, test, vi } from "vitest";
import { setupMonacoWorkers } from "../src/monaco-workers";

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
