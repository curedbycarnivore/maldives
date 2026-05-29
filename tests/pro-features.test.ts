import { describe, expect, test } from "vitest";
import { maldivesProFeatureOptions } from "../src/pro-features";

describe("maldivesProFeatureOptions", () => {
  test("enables semantic highlighting", () => {
    expect(maldivesProFeatureOptions["semanticHighlighting.enabled"]).toBe(true);
  });

  test("enables bracket pair colorization", () => {
    expect(maldivesProFeatureOptions.bracketPairColorization.enabled).toBe(true);
    expect(maldivesProFeatureOptions.bracketPairColorization.independentColorPoolPerBracketType).toBe(true);
  });

  test("enables sticky scroll", () => {
    expect(maldivesProFeatureOptions.stickyScroll.enabled).toBe(true);
    expect(maldivesProFeatureOptions.stickyScroll.maxLineCount).toBe(5);
    expect(maldivesProFeatureOptions.stickyScroll.defaultModel).toBe("indentationModel");
  });

  test("enables inlay hints with JetBrains Mono", () => {
    expect(maldivesProFeatureOptions.inlayHints.enabled).toBe("on");
    expect(maldivesProFeatureOptions.inlayHints.fontFamily).toBe("JetBrains Mono");
    expect(maldivesProFeatureOptions.inlayHints.fontSize).toBe(12);
  });
});
