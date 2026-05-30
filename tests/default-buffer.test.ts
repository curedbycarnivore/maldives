import { describe, expect, test } from "vitest";
import { DEFAULT_SAMPLE_URI, defaultSampleDocument } from "../src/default-buffer";

describe("default Maldives buffer", () => {
  test("is a real complex Effect TSX sample instead of the old toy buffer", () => {
    expect(DEFAULT_SAMPLE_URI).toBe("file:///maldives/sample.tsx");
    expect(defaultSampleDocument).not.toContain("Maldives deterministic sample");
    expect(defaultSampleDocument).toContain("@Injectable()");
    expect(defaultSampleDocument).toContain("class XMLParser<T extends");
    expect(defaultSampleDocument).toContain("Effect.gen(function* ()");
    expect(defaultSampleDocument).toContain("Layer.succeed");
    expect(defaultSampleDocument).toContain("Schema.Struct");
    expect(defaultSampleDocument.split("\n").length).toBeGreaterThanOrEqual(30);
  });
});
