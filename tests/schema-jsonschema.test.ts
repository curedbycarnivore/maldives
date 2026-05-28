import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  formatJsonSchemaComment,
  generateJsonSchemaFromEffectSchemaSource,
  SCHEMA_JSON_SCHEMA_ACTION_ID,
  selectedJsonSchemaTarget,
} from "../src/schema-jsonschema";

const schemaStruct = `Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
  active: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  nickname: Schema.optional(Schema.String),
})`;

describe("Schema → JSONSchema static codegen", () => {
  test.each([
    ["draft-07", "http://json-schema.org/draft-07/schema#"],
    ["2019-09", "https://json-schema.org/draft/2019-09/schema"],
    ["2020-12", "https://json-schema.org/draft/2020-12/schema"],
    ["openapi-3.1", undefined],
  ] as const)("generates %s JSON Schema without executing the user buffer", (target, schemaUrl) => {
    expect(generateJsonSchemaFromEffectSchemaSource(schemaStruct, { target })).toEqual({
      ...(schemaUrl ? { $schema: schemaUrl } : {}),
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        active: { type: "boolean" },
        tags: { type: "array", items: { type: "string" } },
        nickname: { type: "string" },
      },
      required: ["name", "age", "active", "tags"],
      additionalProperties: false,
    });
  });

  test("formats a deterministic editor comment for insertion", () => {
    expect(formatJsonSchemaComment({ type: "string" }, "draft-07")).toBe([
      "",
      "/* Schema → JSONSchema (draft-07)",
      "{",
      '  "type": "string"',
      "}",
      "*/",
    ].join("\n"));
  });

  test("parses user-selected JSON Schema target input", () => {
    expect(selectedJsonSchemaTarget("2020-12")).toBe("2020-12");
    expect(selectedJsonSchemaTarget("unknown")).toBe("draft-07");
  });

  test("exports the stable Monaco action id", () => {
    expect(SCHEMA_JSON_SCHEMA_ACTION_ID).toBe("maldives.schemaToJsonSchema");
  });

  test("dedicated codegen worker disables network primitives", () => {
    const workerSource = readFileSync("src/schema-jsonschema.worker.ts", "utf-8");

    expect(workerSource).toContain("installNoNetworkPolicy");
    expect(workerSource).toContain("fetch");
    expect(workerSource).toContain("WebSocket");
    expect(workerSource).toContain("EventSource");
  });
});
