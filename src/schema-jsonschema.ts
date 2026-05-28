import type { editor, IDisposable, IRange } from "monaco-editor";
import type { JSONSchema, Schema } from "effect";
import * as ts from "typescript";

export const SCHEMA_JSON_SCHEMA_ACTION_ID = "maldives.schemaToJsonSchema";

export type EffectSchemaNamespace = typeof Schema;
export type EffectJsonSchemaNamespace = typeof JSONSchema;

export type JsonSchemaTarget = "draft-07" | "2019-09" | "2020-12" | "openapi-3.1";

export interface GenerateJsonSchemaOptions {
  target?: JsonSchemaTarget;
}

export type JsonSchemaValue = null | boolean | number | string | JsonSchemaValue[] | { [key: string]: JsonSchemaValue };

export function registerSchemaJsonSchemaAction(editorInstance: editor.IStandaloneCodeEditor): IDisposable {
  return editorInstance.addAction({
    id: SCHEMA_JSON_SCHEMA_ACTION_ID,
    label: "Schema → JSONSchema",
    contextMenuGroupId: "navigation",
    run: async () => {
      await insertJsonSchemaForSelection(editorInstance, promptJsonSchemaTarget());
    },
  });
}

export async function insertJsonSchemaForSelection(
  editorInstance: editor.IStandaloneCodeEditor,
  target: JsonSchemaTarget = "draft-07",
): Promise<void> {
  const model = editorInstance.getModel();
  const selection = editorInstance.getSelection();

  if (!model || !selection || selection.isEmpty()) {
    editorInstance.focus();
    return;
  }

  const source = model.getValueInRange(selection);
  const schema = await generateJsonSchemaInWorker(source, target).catch(() => generateJsonSchemaFromEffectSchemaSource(source, { target }));
  const range = insertionRangeAtEnd(selection);

  editorInstance.executeEdits("schema-jsonschema", [{ range, text: formatJsonSchemaComment(schema, target) }]);
  editorInstance.focus();
}

export function generateJsonSchemaFromEffectSchemaSource(
  source: string,
  options: GenerateJsonSchemaOptions = {},
): Record<string, JsonSchemaValue> {
  const target = options.target ?? "draft-07";
  const sourceFile = ts.createSourceFile("schema.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const schemaExpression = findSchemaExpression(sourceFile);

  if (!schemaExpression) {
    throw new Error("Select a Schema.Struct(...) or compatible Effect Schema expression.");
  }

  return withDialect(schemaFromExpression(schemaExpression, sourceFile), target);
}

export function formatJsonSchemaComment(schema: Record<string, JsonSchemaValue>, target: JsonSchemaTarget): string {
  return `\n/* Schema → JSONSchema (${target})\n${JSON.stringify(schema, null, 2)}\n*/`;
}

export function selectedJsonSchemaTarget(input: string | null | undefined): JsonSchemaTarget {
  const normalized = input?.trim().toLowerCase();

  return normalized === "2019-09" || normalized === "2020-12" || normalized === "openapi-3.1" || normalized === "draft-07"
    ? normalized
    : "draft-07";
}

function promptJsonSchemaTarget(): JsonSchemaTarget {
  return selectedJsonSchemaTarget(
    globalThis.prompt?.("JSON Schema target: draft-07, 2019-09, 2020-12, or openapi-3.1", "draft-07"),
  );
}

function generateJsonSchemaInWorker(source: string, target: JsonSchemaTarget): Promise<Record<string, JsonSchemaValue>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./schema-jsonschema.worker.ts", import.meta.url), { type: "module" });
    const requestId = crypto.randomUUID();
    const timeout = globalThis.setTimeout(() => {
      worker.terminate();
      reject(new Error("Schema JSONSchema worker timed out."));
    }, 5000);

    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      if (event.data.requestId !== requestId) {
        return;
      }

      globalThis.clearTimeout(timeout);
      worker.terminate();

      if (event.data.ok) {
        resolve(event.data.schema);
      } else {
        reject(new Error(event.data.error));
      }
    });

    worker.addEventListener("error", (event) => {
      globalThis.clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message));
    });

    worker.postMessage({ requestId, source, target } satisfies WorkerRequest);
  });
}

export interface WorkerRequest {
  requestId: string;
  source: string;
  target: JsonSchemaTarget;
}

export type WorkerResponse =
  | { requestId: string; ok: true; schema: Record<string, JsonSchemaValue> }
  | { requestId: string; ok: false; error: string };

function findSchemaExpression(sourceFile: ts.SourceFile): ts.Expression | undefined {
  let found: ts.Expression | undefined;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }

    if (ts.isCallExpression(node) && isSchemaCall(node, "Struct")) {
      found = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function schemaFromExpression(expression: ts.Expression, sourceFile: ts.SourceFile): Record<string, JsonSchemaValue> {
  if (ts.isCallExpression(expression)) {
    if (isSchemaCall(expression, "Struct")) {
      return structSchema(expression, sourceFile);
    }

    if (isSchemaCall(expression, "Array")) {
      return { type: "array", items: schemaFromFirstArgument(expression, sourceFile) };
    }

    if (isSchemaCall(expression, "Literal")) {
      return literalSchema(expression, sourceFile);
    }

    if (isSchemaCall(expression, "Union")) {
      return { anyOf: expression.arguments.map((argument) => schemaFromExpression(argument, sourceFile)) };
    }

    if (isSchemaCall(expression, "optional") || isSchemaCall(expression, "optionalWith")) {
      return schemaFromFirstArgument(expression, sourceFile);
    }
  }

  if (isSchemaIdentifier(expression, "String")) {
    return { type: "string" };
  }

  if (isSchemaIdentifier(expression, "Number")) {
    return { type: "number" };
  }

  if (isSchemaIdentifier(expression, "Boolean")) {
    return { type: "boolean" };
  }

  throw new Error(`Unsupported Effect Schema expression: ${expression.getText(sourceFile)}`);
}

function structSchema(call: ts.CallExpression, sourceFile: ts.SourceFile): Record<string, JsonSchemaValue> {
  const fields = call.arguments[0];

  if (!fields || !ts.isObjectLiteralExpression(fields)) {
    throw new Error("Schema.Struct(...) must receive an object literal.");
  }

  const properties: Record<string, JsonSchemaValue> = {};
  const required: string[] = [];

  for (const property of fields.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error("Schema.Struct(...) only supports static property assignments.");
    }

    const name = propertyName(property.name);
    const optional = isOptionalSchema(property.initializer);
    properties[name] = schemaFromExpression(property.initializer, sourceFile);

    if (!optional) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function schemaFromFirstArgument(call: ts.CallExpression, sourceFile: ts.SourceFile): Record<string, JsonSchemaValue> {
  const argument = call.arguments[0];

  if (!argument) {
    throw new Error(`${call.expression.getText(sourceFile)} requires a schema argument.`);
  }

  return schemaFromExpression(argument, sourceFile);
}

function literalSchema(call: ts.CallExpression, sourceFile: ts.SourceFile): Record<string, JsonSchemaValue> {
  const values = call.arguments.map((argument) => literalValue(argument, sourceFile));

  return values.length === 1 ? { const: values[0] } : { enum: values };
}

function literalValue(node: ts.Expression, sourceFile: ts.SourceFile): JsonSchemaValue {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  throw new Error(`Unsupported Schema.Literal value: ${node.getText(sourceFile)}`);
}

function withDialect(schema: Record<string, JsonSchemaValue>, target: JsonSchemaTarget): Record<string, JsonSchemaValue> {
  if (target === "openapi-3.1") {
    return schema;
  }

  const dialects: Record<Exclude<JsonSchemaTarget, "openapi-3.1">, string> = {
    "draft-07": "http://json-schema.org/draft-07/schema#",
    "2019-09": "https://json-schema.org/draft/2019-09/schema",
    "2020-12": "https://json-schema.org/draft/2020-12/schema",
  };

  return { $schema: dialects[target], ...schema };
}

function isOptionalSchema(expression: ts.Expression): boolean {
  return ts.isCallExpression(expression) && (isSchemaCall(expression, "optional") || isSchemaCall(expression, "optionalWith"));
}

function isSchemaCall(call: ts.CallExpression, methodName: string): boolean {
  return ts.isPropertyAccessExpression(call.expression) && isSchemaNamespace(call.expression.expression) && call.expression.name.text === methodName;
}

function isSchemaIdentifier(expression: ts.Expression, propertyName: string): boolean {
  return ts.isPropertyAccessExpression(expression) && isSchemaNamespace(expression.expression) && expression.name.text === propertyName;
}

function isSchemaNamespace(expression: ts.Expression): boolean {
  return ts.isIdentifier(expression) && expression.text === "Schema";
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  throw new Error("Schema.Struct(...) field names must be static identifiers or literals.");
}

function insertionRangeAtEnd(range: IRange): IRange {
  return {
    startLineNumber: range.endLineNumber,
    startColumn: range.endColumn,
    endLineNumber: range.endLineNumber,
    endColumn: range.endColumn,
  };
}
