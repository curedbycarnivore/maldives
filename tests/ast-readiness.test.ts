import { initializeTreeSitter, registerDynamicLanguage } from "@ast-grep/wasm";
import { describe, expect, test, vi } from "vitest";
import { ensureAstReady, initializeAstSmartSelection } from "../src/ast-smart-selection";

vi.mock("@ast-grep/wasm", () => ({
  initializeTreeSitter: vi.fn(() => Promise.resolve()),
  registerDynamicLanguage: vi.fn(() => Promise.resolve()),
  parse: vi.fn(),
}));

describe("ensureAstReady", () => {
  test("exposes the shared ast-grep initialization promise for app readiness", async () => {
    await Promise.all([ensureAstReady(), initializeAstSmartSelection(), ensureAstReady()]);

    expect(initializeTreeSitter).toHaveBeenCalledTimes(1);
    expect(registerDynamicLanguage).toHaveBeenCalledTimes(1);
  });
});
