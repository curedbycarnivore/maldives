import type * as monaco from "monaco-editor";
import * as ts from "typescript";

export interface EffectHoverDoc {
  summary: string;
  example: string;
  url: string;
}

type MonacoApi = typeof monaco;
type QuickInfoDisplayPart = { text?: string };
type QuickInfo = { displayParts?: QuickInfoDisplayPart[]; textSpan?: { start: number; length: number } };
type DefinitionInfo = { fileName?: string };
type TypeScriptWorker = {
  getQuickInfoAtPosition(fileName: string, offset: number): Promise<QuickInfo | undefined>;
  getDefinitionAtPosition?(fileName: string, offset: number): Promise<DefinitionInfo[] | undefined>;
};
type TypeScriptWorkerFactory = (uri: monaco.editor.ITextModel["uri"]) => Promise<TypeScriptWorker>;
type TypeScriptWithWorker = { getTypeScriptWorker?: () => Promise<TypeScriptWorkerFactory> };

/*
 * P12D Effect hover security gates:
 * SG-P12D-1: Layer dependency diagrams only activate for a Layer namespace imported from "effect"
 *             (including local aliases); local Layer lookalikes never get Effect hover UI.
 * SG-P12D-2: Hover content is derived from the current Monaco model AST and emitted as markdown/text
 *             only; no model text is executed or injected as HTML.
 */

export const EFFECT_HOVER_DOCS = {
  "Effect.gen": {
    summary: "Build an Effect by yielding other Effects in generator style.",
    example: "const program = Effect.gen(function* () {\n  const value = yield* Effect.succeed(1)\n  return value\n})",
    url: "https://effect.website/docs/getting-started/using-generators/",
  },
  "Effect.map": {
    summary: "Transform the success value of an Effect without changing its error or context.",
    example: "pipe(Effect.succeed(1), Effect.map((n) => n + 1))",
    url: "https://effect.website/docs/getting-started/using-generators/",
  },
  pipe: {
    summary: "Thread a value through a sequence of functions from left to right.",
    example: "pipe(value, Effect.map((n) => n + 1))",
    url: "https://effect.website/docs/code-style/pipeline/",
  },
  Layer: {
    summary: "Describe how services are constructed and provided to Effect programs.",
    example: "const Live = Layer.effect(Service, Effect.succeed(implementation))",
    url: "https://effect.website/docs/requirements-management/layers/",
  },
  Schema: {
    summary: "Define runtime schemas that derive validation, encoding, decoding, and JSON Schema.",
    example: "const User = Schema.Struct({ name: Schema.String })",
    url: "https://effect.website/docs/schema/introduction/",
  },
  Match: {
    summary: "Pattern match values with composable predicates and exhaustive fallbacks.",
    example: "Match.value(input).pipe(Match.when(\"ready\", () => true), Match.orElse(() => false))",
    url: "https://effect.website/docs/code-style/pattern-matching/",
  },
  Option: {
    summary: "Represent an optional value without using null or undefined.",
    example: "Option.match(option, { onNone: () => 0, onSome: (value) => value })",
    url: "https://effect.website/docs/data-types/option/",
  },
  Either: {
    summary: "Represent a value that is either a typed failure or a success.",
    example: "Either.match(result, { onLeft: handleError, onRight: handleValue })",
    url: "https://effect.website/docs/data-types/either/",
  },
  Schedule: {
    summary: "Describe recurrence, retry, and repetition policies for Effects.",
    example: "Effect.retry(program, Schedule.exponential(\"100 millis\"))",
    url: "https://effect.website/docs/scheduling/schedules/",
  },
  Stream: {
    summary: "Model effectful streams of values with resource safety and backpressure.",
    example: "Stream.fromIterable([1, 2, 3])",
    url: "https://effect.website/docs/stream/introduction/",
  },
  Fiber: {
    summary: "Represent a lightweight Effect runtime fiber that can be joined or interrupted.",
    example: "const fiber = yield* Effect.fork(program)\nyield* Fiber.interrupt(fiber)",
    url: "https://effect.website/docs/concurrency/fibers/",
  },
} as const satisfies Record<string, EffectHoverDoc>;

export type EffectHoverSymbol = keyof typeof EFFECT_HOVER_DOCS;

export function effectHoverDocForSymbol(symbol: string): EffectHoverDoc | undefined {
  return EFFECT_HOVER_DOCS[symbol as EffectHoverSymbol];
}

export function effectHoverSymbolFromQuickInfo(displayText: string): EffectHoverSymbol | undefined {
  const symbols = Object.keys(EFFECT_HOVER_DOCS).sort((left, right) => right.length - left.length) as EffectHoverSymbol[];

  return symbols.find((symbol) => new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(symbol)}([^A-Za-z0-9_$]|$)`).test(displayText));
}

export function effectHoverSymbolFromSourceAtOffset(source: string, offset: number): EffectHoverSymbol | undefined {
  const sourceFile = ts.createSourceFile("effect-hover.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const effectImports = effectImportsFromSourceFile(sourceFile);
  let found: EffectHoverSymbol | undefined;

  function visit(node: ts.Node): void {
    if (found || offset < node.getStart(sourceFile) || offset > node.getEnd()) {
      return;
    }

    if (ts.isIdentifier(node)) {
      found = effectHoverSymbolForIdentifier(node, effectImports);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

export function layerDependencyDiagramForSourceAtOffset(source: string, offset: number): string | undefined {
  const sourceFile = ts.createSourceFile("effect-layer-hover.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const layerImports = effectNamedImportsFromSourceFile(sourceFile, "Layer");
  const call = layerCompositionCallAtOffset(sourceFile, offset, layerImports);

  if (!call) {
    return undefined;
  }

  const graph = collectLayerGraph(call, sourceFile, layerImports);

  if (graph.layers.length === 0) {
    return undefined;
  }

  return [
    "Layer dependency diagram",
    "Layers:",
    ...graph.layers.map((layer) => `- ${layer}`),
    "Edges:",
    ...(graph.edges.length > 0 ? graph.edges.map((edge) => `- ${edge.from} -> ${edge.to}`) : ["- none"]),
  ].join("\n");
}

export function registerEffectHoverProvider(monacoApi: MonacoApi): monaco.IDisposable {
  return monacoApi.languages.registerHoverProvider("typescript", {
    async provideHover(model, position) {
      const layerDiagram = layerDependencyDiagramForSourceAtOffset(model.getValue(), model.getOffsetAt(position));

      if (layerDiagram) {
        return {
          contents: [
            { value: "**Layer dependency diagram**" },
            { value: `\`\`\`text\n${layerDiagram}\n\`\`\`` },
          ],
        };
      }

      const offset = model.getOffsetAt(position);
      const [quickInfo, definitionFileNames] = await Promise.all([
        quickInfoAtPosition(monacoApi, model, position),
        definitionFileNamesAtOffset(monacoApi, model, offset),
      ]);
      const sourceSymbol = effectHoverSymbolFromSourceAtOffset(model.getValue(), offset);
      const symbol = sourceSymbol && hasEffectDefinitionProvenance(definitionFileNames) ? sourceSymbol : undefined;
      const doc = symbol ? effectHoverDocForSymbol(symbol) : undefined;

      if (!doc) {
        return undefined;
      }

      return {
        range: quickInfo?.textSpan ? rangeForTextSpan(monacoApi, model, quickInfo.textSpan) : undefined,
        contents: [
          { value: `**${symbol}** — ${doc.summary}` },
          { value: `**Example**\n\n\`\`\`ts\n${doc.example}\n\`\`\`` },
          { value: `[Effect docs](${doc.url}) — ${doc.url}` },
        ],
      };
    },
  });
}

async function quickInfoAtPosition(
  monacoApi: MonacoApi,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): Promise<QuickInfo | undefined> {
  const worker = await typeScriptWorkerForModel(monacoApi, model);
  return worker?.getQuickInfoAtPosition(model.uri.toString(), model.getOffsetAt(position));
}

async function definitionFileNamesAtOffset(monacoApi: MonacoApi, model: monaco.editor.ITextModel, offset: number): Promise<string[]> {
  const worker = await typeScriptWorkerForModel(monacoApi, model);
  const definitions = await worker?.getDefinitionAtPosition?.(model.uri.toString(), offset);
  return definitions?.map((definition) => definition.fileName).filter((fileName): fileName is string => Boolean(fileName)) ?? [];
}

async function typeScriptWorkerForModel(monacoApi: MonacoApi, model: monaco.editor.ITextModel): Promise<TypeScriptWorker | undefined> {
  const getTypeScriptWorker = (monacoApi.languages.typescript as unknown as TypeScriptWithWorker).getTypeScriptWorker;

  if (!getTypeScriptWorker) {
    return undefined;
  }

  const getWorker = await getTypeScriptWorker();
  return getWorker(model.uri);
}

function hasEffectDefinitionProvenance(fileNames: string[]): boolean {
  return fileNames.some((fileName) => fileName.includes("/node_modules/effect/") || fileName.includes("/node_modules/@types/effect-stub/"));
}

interface LayerGraph {
  layers: string[];
  edges: Array<{ from: string; to: string }>;
}

type EffectImportSet = Set<string>;

function effectImportsFromSourceFile(sourceFile: ts.SourceFile): EffectImportSet {
  const imports = new Set<string>();

  for (const statement of effectImportDeclarations(sourceFile)) {
    const clause = statement.importClause;
    const namedBindings = clause?.namedBindings;

    if (clause?.name) {
      imports.add(clause.name.text);
    }

    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      imports.add(namedBindings.name.text);
    }

    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        imports.add(element.name.text);
      }
    }
  }

  return imports;
}

function effectNamedImportsFromSourceFile(sourceFile: ts.SourceFile, importedName: string): EffectImportSet {
  const imports = new Set<string>();

  for (const statement of effectImportDeclarations(sourceFile)) {
    const namedBindings = statement.importClause?.namedBindings;

    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const element of namedBindings.elements) {
      const originalName = element.propertyName?.text ?? element.name.text;

      if (originalName === importedName) {
        imports.add(element.name.text);
      }
    }
  }

  return imports;
}

function effectImportDeclarations(sourceFile: ts.SourceFile): ts.ImportDeclaration[] {
  return sourceFile.statements.filter(
    (statement): statement is ts.ImportDeclaration =>
      ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "effect",
  );
}

function effectHoverSymbolForIdentifier(identifier: ts.Identifier, effectImports: EffectImportSet): EffectHoverSymbol | undefined {
  const parent = identifier.parent;

  if (ts.isPropertyAccessExpression(parent)) {
    if (parent.name === identifier && ts.isIdentifier(parent.expression) && effectImports.has(parent.expression.text)) {
      const memberSymbol = `${parent.expression.text}.${identifier.text}`;
      if (isEffectHoverSymbol(memberSymbol)) {
        return memberSymbol;
      }

      return isEffectHoverSymbol(parent.expression.text) ? parent.expression.text : undefined;
    }

    if (parent.expression === identifier && effectImports.has(identifier.text) && isEffectHoverSymbol(identifier.text)) {
      return identifier.text;
    }
  }

  return effectImports.has(identifier.text) && isEffectHoverSymbol(identifier.text) ? identifier.text : undefined;
}

function isEffectHoverSymbol(symbol: string): symbol is EffectHoverSymbol {
  return Object.hasOwn(EFFECT_HOVER_DOCS, symbol);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function layerCompositionCallAtOffset(sourceFile: ts.SourceFile, offset: number, layerImports: EffectImportSet): ts.CallExpression | undefined {
  let found: ts.CallExpression | undefined;

  function visit(node: ts.Node): void {
    if (offset < node.getFullStart() || offset > node.getEnd()) {
      return;
    }

    if (ts.isCallExpression(node) && layerCompositionMethod(node, layerImports, sourceFile)) {
      found = node;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function collectLayerGraph(expression: ts.Expression, sourceFile: ts.SourceFile, layerImports: EffectImportSet): LayerGraph {
  const layers: string[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  function addLayer(layer: string): void {
    if (!layers.includes(layer)) {
      layers.push(layer);
    }
  }

  function addEdge(from: string, to: string): void {
    if (!edges.some((edge) => edge.from === from && edge.to === to)) {
      edges.push({ from, to });
    }
  }

  function collect(expr: ts.Expression): string[] {
    if (ts.isCallExpression(expr)) {
      const method = layerCompositionMethod(expr, layerImports, sourceFile);

      if (method === "merge") {
        return expr.arguments.flatMap((argument) => collect(argument));
      }

      if (method === "provide" || method === "provideMerge") {
        const targetLayers = expr.arguments[0] ? collect(expr.arguments[0]) : [];
        const providerLayers = expr.arguments[1] ? collect(expr.arguments[1]) : [];

        for (const provider of providerLayers) {
          for (const target of targetLayers) {
            addEdge(provider, target);
          }
        }

        return targetLayers.length > 0 ? targetLayers : providerLayers;
      }
    }

    const label = layerExpressionLabel(expr, sourceFile, layerImports);
    addLayer(label);
    return [label];
  }

  collect(expression);
  return { layers, edges };
}

function layerCompositionMethod(
  call: ts.CallExpression,
  layerImports: EffectImportSet,
  sourceFile: ts.SourceFile,
): "merge" | "provide" | "provideMerge" | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return undefined;
  }

  const namespace = call.expression.expression;
  if (!ts.isIdentifier(namespace) || !layerImports.has(namespace.text) || isShadowedLocalBinding(namespace, sourceFile)) {
    return undefined;
  }

  const method = call.expression.name.text;
  return method === "merge" || method === "provide" || method === "provideMerge" ? method : undefined;
}

function isShadowedLocalBinding(identifier: ts.Identifier, sourceFile: ts.SourceFile): boolean {
  const identifierStart = identifier.getStart(sourceFile);
  let shadowed = false;

  function visit(node: ts.Node): void {
    if (shadowed || node === identifier) {
      return;
    }

    const name = localDeclarationName(node);
    if (name?.text === identifier.text) {
      const scope = lexicalScopeForDeclaration(node, sourceFile);
      shadowed = scope.getStart(sourceFile) <= identifierStart && identifierStart <= scope.getEnd();
      if (shadowed) {
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return shadowed;
}

function localDeclarationName(node: ts.Node): ts.Identifier | undefined {
  if (ts.isImportSpecifier(node)) {
    return undefined;
  }

  if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
    return node.name;
  }

  if (
    (ts.isVariableDeclaration(node) ||
      ts.isParameter(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name &&
    ts.isIdentifier(node.name)
  ) {
    return node.name;
  }

  return undefined;
}

function lexicalScopeForDeclaration(node: ts.Node, sourceFile: ts.SourceFile): ts.Node {
  if (ts.isParameter(node)) {
    const owner = node.parent;
    if (
      (ts.isFunctionDeclaration(owner) ||
        ts.isFunctionExpression(owner) ||
        ts.isArrowFunction(owner) ||
        ts.isMethodDeclaration(owner) ||
        ts.isConstructorDeclaration(owner)) &&
      owner.body
    ) {
      return owner.body;
    }
    return owner ?? sourceFile;
  }

  let current = node.parent;

  while (current && !ts.isSourceFile(current) && !ts.isBlock(current) && !ts.isModuleBlock(current)) {
    current = current.parent;
  }

  return current ?? sourceFile;
}

function layerExpressionLabel(expression: ts.Expression, sourceFile: ts.SourceFile, layerImports: EffectImportSet): string {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.getText(sourceFile);
  }

  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  if (ts.isCallExpression(expression)) {
    const effectLayerName = layerEffectName(expression, layerImports, sourceFile);

    if (effectLayerName) {
      return effectLayerName;
    }

    return expression.expression.getText(sourceFile);
  }

  return expression.getText(sourceFile);
}

function layerEffectName(call: ts.CallExpression, layerImports: EffectImportSet, sourceFile: ts.SourceFile): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return undefined;
  }

  const namespace = call.expression.expression;
  if (!ts.isIdentifier(namespace) || !layerImports.has(namespace.text) || isShadowedLocalBinding(namespace, sourceFile)) {
    return undefined;
  }

  if (call.expression.name.text !== "effect") {
    return undefined;
  }

  const firstArgument = call.arguments[0];

  if (firstArgument && (ts.isStringLiteral(firstArgument) || ts.isNoSubstitutionTemplateLiteral(firstArgument))) {
    return firstArgument.text;
  }

  if (firstArgument && ts.isIdentifier(firstArgument)) {
    return firstArgument.text;
  }

  return undefined;
}

function displayPartsToString(parts: QuickInfoDisplayPart[] | undefined): string {
  return parts?.map((part) => part.text ?? "").join("") ?? "";
}

function rangeForTextSpan(
  monacoApi: MonacoApi,
  model: monaco.editor.ITextModel,
  textSpan: { start: number; length: number },
): monaco.Range {
  const start = model.getPositionAt(textSpan.start);
  const end = model.getPositionAt(textSpan.start + textSpan.length);
  return new monacoApi.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}
