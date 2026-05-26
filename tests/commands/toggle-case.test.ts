import { describe, expect, test } from "vitest";
import { toggleCaseText, toggleCamelDashCaseText } from "../../src/keybindings/index";

describe("toggleCaseText", () => {
  test("uppercases lowercase text", () => {
    expect(toggleCaseText("hello")).toBe("HELLO");
  });

  test("lowercases ALL CAPS text", () => {
    expect(toggleCaseText("HELLO")).toBe("hello");
  });

  test("uppercases mixed case (not all upper)", () => {
    expect(toggleCaseText("Hello")).toBe("HELLO");
  });
});

describe("toggleCamelDashCaseText", () => {
  test("camelCase → dash-case", () => {
    expect(toggleCamelDashCaseText("camelCaseWord")).toBe("camel-case-word");
  });

  test("dash-case → snake_case", () => {
    expect(toggleCamelDashCaseText("camel-case-word")).toBe("camel_case_word");
  });

  test("snake_case → camelCase", () => {
    expect(toggleCamelDashCaseText("camel_case_word")).toBe("camelCaseWord");
  });
});
