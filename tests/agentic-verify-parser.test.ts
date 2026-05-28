import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const parser = "/Users/jrad/ralph-loops/2026-05-25-build-maldives-custom-monaco/scripts/parse-agentic-verdict.sh";

describe("agentic verifier verdict parser", () => {
  test("ignores rubric echo and returns the assistant's reconstructed verdict", () => {
    const dir = mkdtempSync(join(tmpdir(), "maldives-verifier-"));
    const stream = join(dir, "pi.jsonl");
    writeFileSync(
      stream,
      [
        JSON.stringify({
          type: "message_end",
          message: {
            role: "user",
            content: [{ type: "text", text: "Rubric example says VERDICT: PASS" }],
          },
        }),
        JSON.stringify({
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "VERDICT: FAIL: actual regression\nEvidence line" }],
          },
        }),
      ].join("\n"),
    );

    const verdict = execFileSync(parser, [stream], { encoding: "utf-8" }).trim();

    expect(verdict).toBe("VERDICT: FAIL: actual regression");
  });
});
