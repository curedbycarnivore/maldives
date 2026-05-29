import * as ts from "typescript";

export interface PromiseToEffectRefactor {
  text: string;
}

type SupportedFunction = ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction;

export function convertPromiseFunctionToEffectGen(source: string, offset: number): string | undefined {
  const sourceFile = ts.createSourceFile("maldives.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const candidate = findAsyncAwaitFunctionAtOffset(sourceFile, offset);

  if (!candidate || !candidate.body || !ts.isBlock(candidate.body) || !canSafelyConvert(candidate.body)) {
    return undefined;
  }

  const replacement = convertFunction(source, sourceFile, candidate);
  const replaced = `${source.slice(0, candidate.getStart(sourceFile))}${replacement}${source.slice(candidate.getEnd())}`;

  return ensureEffectImport(replaced);
}

function findAsyncAwaitFunctionAtOffset(sourceFile: ts.SourceFile, offset: number): SupportedFunction | undefined {
  let match: SupportedFunction | undefined;

  function visit(node: ts.Node): void {
    if (!containsOffset(sourceFile, node, offset)) {
      return;
    }

    const body = isSupportedFunction(node) ? node.body : undefined;

    if (isSupportedFunction(node) && body && hasAsyncModifier(node) && ts.isBlock(body) && directAwaitExpressions(body).length > 0) {
      match = node;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return match;
}

function convertFunction(source: string, sourceFile: ts.SourceFile, node: SupportedFunction): string {
  const body = node.body;

  if (!body || !ts.isBlock(body)) {
    return node.getText(sourceFile);
  }

  const functionIndent = indentationBefore(source, node.getStart(sourceFile));
  const bodyIndent = `${functionIndent}  `;
  const header = source
    .slice(node.getStart(sourceFile), body.getStart(sourceFile))
    .replace(/\basync\s+/, "")
    .replace(/:\s*Promise<([^>]+)>/, ": Effect.Effect<$1>")
    .replace(/=>\s*$/, "=> ");
  const rewrittenBody = rewriteAwaitExpressions(source, sourceFile, body);
  const nestedBody = rewrittenBody
    .replace(/^\n/, "")
    .replace(/\n\s*$/, "")
    .split("\n")
    .map((line) => `${bodyIndent}  ${line.trimStart()}`)
    .join("\n");
  const isArrow = ts.isArrowFunction(node);

  if (isArrow) {
    return `${header}Effect.gen(function*() {\n${nestedBody}\n${bodyIndent}})`;
  }

  return `${header}{\n${bodyIndent}return Effect.gen(function*() {\n${nestedBody}\n${bodyIndent}});\n${functionIndent}}`;
}

function rewriteAwaitExpressions(source: string, sourceFile: ts.SourceFile, body: ts.Block): string {
  const bodyStart = body.getStart(sourceFile) + 1;
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const node of directAwaitExpressions(body)) {
    const expression = node.expression.getText(sourceFile);
    const effectful = /^Effect\./.test(expression) ? `yield* ${expression}` : `yield* Effect.tryPromise(() => ${expression})`;
    replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: effectful });
  }

  let bodyText = source.slice(bodyStart, body.getEnd() - 1);

  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    const start = replacement.start - bodyStart;
    const end = replacement.end - bodyStart;
    bodyText = `${bodyText.slice(0, start)}${replacement.text}${bodyText.slice(end)}`;
  }

  return bodyText;
}

function canSafelyConvert(body: ts.Block): boolean {
  const awaits = directAwaitExpressions(body);

  return awaits.length > 0 && !containsTryStatement(body) && !containsBindingSensitiveExpression(body) && awaits.every(isSafeAwaitExpression);
}

function directAwaitExpressions(body: ts.Block): ts.AwaitExpression[] {
  const awaits: ts.AwaitExpression[] = [];

  function visit(node: ts.Node): void {
    if (node !== body && isSupportedFunction(node)) {
      return;
    }

    if (ts.isAwaitExpression(node)) {
      awaits.push(node);
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return awaits;
}

function isSafeAwaitExpression(node: ts.AwaitExpression): boolean {
  if (isObviouslyNonPromiseExpression(node.expression) || expressionContainsAwait(node.expression)) {
    return false;
  }

  return isVariableInitializer(node) || isReturnExpression(node);
}

function expressionContainsAwait(expression: ts.Expression): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }

    if (ts.isAwaitExpression(node)) {
      found = true;
      return;
    }

    if (node !== expression && isSupportedFunction(node)) {
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(expression);
  return found;
}

function isVariableInitializer(node: ts.AwaitExpression): boolean {
  return ts.isVariableDeclaration(node.parent) && node.parent.initializer === node;
}

function isReturnExpression(node: ts.AwaitExpression): boolean {
  return ts.isReturnStatement(node.parent) && node.parent.expression === node;
}

function isObviouslyNonPromiseExpression(expression: ts.Expression): boolean {
  return (
    ts.isIdentifier(expression) ||
    ts.isNumericLiteral(expression) ||
    ts.isStringLiteral(expression) ||
    ts.isArrayLiteralExpression(expression) ||
    ts.isObjectLiteralExpression(expression) ||
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword
  );
}

function containsBindingSensitiveExpression(body: ts.Block): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }

    if (node !== body && isSupportedFunction(node)) {
      return;
    }

    if (
      node.kind === ts.SyntaxKind.ThisKeyword ||
      node.kind === ts.SyntaxKind.SuperKeyword ||
      (ts.isIdentifier(node) && node.text === "arguments")
    ) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
}

function containsTryStatement(body: ts.Block): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }

    if (node !== body && isSupportedFunction(node)) {
      return;
    }

    if (ts.isTryStatement(node)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(body);
  return found;
}

function isSupportedFunction(node: ts.Node): node is SupportedFunction {
  return ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);
}

function hasAsyncModifier(node: SupportedFunction): boolean {
  return ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) ?? false;
}

function containsOffset(sourceFile: ts.SourceFile, node: ts.Node, offset: number): boolean {
  return offset >= node.getStart(sourceFile) && offset <= node.getEnd();
}

function indentationBefore(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return source.slice(lineStart, offset).match(/^\s*/)?.[0] ?? "";
}

function ensureEffectImport(source: string): string {
  if (/from\s+["']effect["']/.test(source)) {
    return source;
  }

  return `import { Effect } from "effect";\n${source}`;
}
