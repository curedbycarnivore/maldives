import * as ts from "typescript";

export interface PromiseToEffectRefactor {
  text: string;
}

type SupportedFunction = ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction;

export function convertPromiseFunctionToEffectGen(source: string, offset: number): string | undefined {
  const sourceFile = ts.createSourceFile("maldives.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const candidate = findAsyncAwaitFunctionAtOffset(sourceFile, offset);

  if (!candidate || !candidate.body || !ts.isBlock(candidate.body)) {
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

    if (isSupportedFunction(node) && body && hasAsyncModifier(node) && ts.isBlock(body) && containsAwait(body)) {
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

  function visit(node: ts.Node): void {
    if (ts.isAwaitExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      const effectful = /^Effect\./.test(expression) ? `yield* ${expression}` : `yield* Effect.tryPromise(() => ${expression})`;
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd(), text: effectful });
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(body);

  let bodyText = source.slice(bodyStart, body.getEnd() - 1);

  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    const start = replacement.start - bodyStart;
    const end = replacement.end - bodyStart;
    bodyText = `${bodyText.slice(0, start)}${replacement.text}${bodyText.slice(end)}`;
  }

  return bodyText;
}

function containsAwait(node: ts.Node): boolean {
  let found = false;

  function visit(child: ts.Node): void {
    if (found) {
      return;
    }

    if (ts.isAwaitExpression(child)) {
      found = true;
      return;
    }

    ts.forEachChild(child, visit);
  }

  visit(node);
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
