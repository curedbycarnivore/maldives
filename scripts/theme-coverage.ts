#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { themeCoverageAuditAttributes, themeCoverageAuditTargets } from "../src/theme/coverage-audit";

const classifiedChildLeafNames = [
  "FOREGROUND",
  "FONT_TYPE",
  "EFFECT_TYPE",
  "BACKGROUND",
  "EFFECT_COLOR",
  "ERROR_STRIPE_COLOR",
];

const classifiedTopLevelOptionNames = [
  "EDITOR_FONT_NAME",
  "EDITOR_FONT_SIZE",
  "ABSTRACT_CLASS_NAME_ATTRIBUTES",
  "ADDED_LINES_COLOR",
  "ANNOTATION_NAME_ATTRIBUTES",
  "ANNOTATIONS_COLOR",
  "ANNOTATIONS_MERGED_COLOR",
  "BAD_CHARACTER",
  "BOOKMARKS_ATTRIBUTES",
  "BREAKPOINT_ATTRIBUTES",
  "BRACE_ATTR",
  "BRACKET_ATTR",
  "BREADCRUMBS_CURRENT",
  "BREADCRUMBS_HOVERED",
  "CLASS_NAME_ATTRIBUTES",
  "CLASS_REFERENCE",
  "BUILDOUT.KEY",
  "BUILDOUT.KEY_VALUE_SEPARATOR",
  "BUILDOUT.LINE_COMMENT",
  "BUILDOUT.SECTION_NAME",
  "BUILDOUT.VALUE",
  "C.KEYWORD",
  "APACHE_CONFIG.ARG_LEXEM",
  "APACHE_CONFIG.COMMENT",
  "APACHE_CONFIG.IDENTIFIER",
  "BASH.EXTERNAL_COMMAND",
  "BASH.HERE_DOC",
  "BLOCK_TERMINAL_COMMAND",
  "COFFEESCRIPT.BAD_CHARACTER",
  "COFFEESCRIPT.BLOCK_COMMENT",
  "COFFEESCRIPT.BOOLEAN",
  "COFFEESCRIPT.CLASS_NAME",
  "COFFEESCRIPT.ESCAPE_SEQUENCE",
  "COFFEESCRIPT.EXISTENTIAL",
  "COFFEESCRIPT.EXPRESSIONS_SUBSTITUTION_MARK",
  "COFFEESCRIPT.FUNCTION",
  "COFFEESCRIPT.FUNCTION_BINDING",
  "COFFEESCRIPT.FUNCTION_NAME",
  "COFFEESCRIPT.GLOBAL_VARIABLE",
  "COFFEESCRIPT.HEREDOC_CONTENT",
  "COFFEESCRIPT.HEREDOC_ID",
  "COFFEESCRIPT.HEREGEX_ID",
  "COFFEESCRIPT.JAVASCRIPT_ID",
  "COFFEESCRIPT.KEYWORD",
  "COFFEESCRIPT.LINE_COMMENT",
  "COFFEESCRIPT.LOCAL_VARIABLE",
  "COFFEESCRIPT.NUMBER",
  "COFFEESCRIPT.OBJECT_KEY",
  "COFFEESCRIPT.OPERATIONS",
  "COFFEESCRIPT.PROTOTYPE",
  "COFFEESCRIPT.REGULAR_EXPRESSION_CONTENT",
  "COFFEESCRIPT.REGULAR_EXPRESSION_FLAG",
  "COFFEESCRIPT.REGULAR_EXPRESSION_ID",
  "COFFEESCRIPT.STRING",
  "COFFEESCRIPT.STRING_LITERAL",
  "COFFEESCRIPT.THIS",
  "CONSTRUCTOR_CALL_ATTRIBUTES",
  "CONSTRUCTOR_DECLARATION_ATTRIBUTES",
  "CPP.BLOCK_COMMENT",
  "CPP.CONSTANT",
  "CPP.DOT",
  "CPP.FIELD",
  "CPP.FUNCTION",
  "CPP.KEYWORD",
  "CPP.LABEL",
  "CPP.LINE_COMMENT",
  "CPP.MACROS",
  "CPP.METHOD",
  "CPP.NAMESPACE",
  "CPP.NUMBER",
  "CPP.OPERATION_SIGN",
  "CPP.PARAMETER",
  "CPP.PP_ARG",
  "CPP.PP_SKIPPED",
  "CPP.STATIC",
  "CPP.STATIC_FUNCTION",
  "CPP.STRING",
  "CPP.TYPE",
  "CPP.UNUSED",
  "CONSOLE_BACKGROUND_KEY",
  "CONSOLE_BLACK_OUTPUT",
  "CONSOLE_BLUE_BRIGHT_OUTPUT",
  "CONSOLE_BLUE_OUTPUT",
  "CONSOLE_CYAN_BRIGHT_OUTPUT",
  "CONSOLE_CYAN_OUTPUT",
  "CONSOLE_DARKGRAY_OUTPUT",
  "CONSOLE_ERROR_OUTPUT",
  "CONSOLE_FONT_NAME",
  "CONSOLE_FONT_SIZE",
  "CONSOLE_GRAY_OUTPUT",
  "CONSOLE_GREEN_BRIGHT_OUTPUT",
  "CONSOLE_GREEN_OUTPUT",
  "CONSOLE_LINE_SPACING",
  "CONSOLE_MAGENTA_BRIGHT_OUTPUT",
  "CONSOLE_MAGENTA_OUTPUT",
  "CONSOLE_NORMAL_OUTPUT",
  "CONSOLE_RED_BRIGHT_OUTPUT",
  "CONSOLE_RED_OUTPUT",
  "CONSOLE_SYSTEM_OUTPUT",
  "CONSOLE_USER_INPUT",
  "CONSOLE_WHITE_OUTPUT",
  "CONSOLE_YELLOW_BRIGHT_OUTPUT",
  "CONSOLE_YELLOW_OUTPUT",
  "CONDITIONALLY_NOT_COMPILED",
  "CSS.COLOR",
  "CSS.COMMENT",
  "CSS.FUNCTION",
  "CSS.IDENT",
  "CSS.IMPORTANT",
  "CSS.KEYWORD",
  "CSS.NUMBER",
  "CSS.OPERATORS",
  "CSS.PROPERTY_NAME",
  "CSS.PROPERTY_VALUE",
  "CSS.STRING",
  "CSS.TAG_NAME",
  "CSS.URL",
];

export interface IclsOptionNameIndex {
  totalOptions: number;
  uniqueNames: string[];
  occurrences: Record<string, number>;
  samplePaths: Record<string, string[]>;
  pathsByName: Record<string, string[]>;
}

export interface ThemeCoverageUnmappedEntry {
  name: string;
  occurrences: number;
  samplePaths: string[];
}

export interface ThemeCoverageMappedPath {
  path: string;
  monacoTargets: string[];
}

export interface ThemeCoverageDeferredPath {
  path: string;
  reason: string;
}

export interface ThemeCoverageChildLeafReport {
  name: string;
  occurrences: number;
  mappedPaths: ThemeCoverageMappedPath[];
  deferredPaths: ThemeCoverageDeferredPath[];
}

export interface ThemeCoverageReport {
  totalOptions: number;
  uniqueOptionNames: number;
  mapped: string[];
  unmapped: ThemeCoverageUnmappedEntry[];
  top50Unmapped: ThemeCoverageUnmappedEntry[];
  classifiedChildLeaves: ThemeCoverageChildLeafReport[];
  classifiedTopLevelOptions: ThemeCoverageChildLeafReport[];
}

export function extractIclsOptionNames(xmlContent: string): IclsOptionNameIndex {
  const occurrences = new Map<string, number>();
  const samplePaths = new Map<string, string[]>();
  const pathsByName = new Map<string, string[]>();
  const stack: string[] = [];
  const tagPattern = /<option\s+name="([^"]+)"[^>]*>|<\/option>/g;

  for (const match of xmlContent.matchAll(tagPattern)) {
    const tag = match[0];
    const [, name] = match;

    if (tag.startsWith("</")) {
      stack.pop();
      continue;
    }

    occurrences.set(name, (occurrences.get(name) ?? 0) + 1);
    const path = [...stack, name].join(".");
    const allPaths = pathsByName.get(name) ?? [];
    allPaths.push(path);
    pathsByName.set(name, allPaths);

    const paths = samplePaths.get(name) ?? [];
    if (paths.length < 5) {
      paths.push(path);
      samplePaths.set(name, paths);
    }

    if (!/\/\s*>$/.test(tag)) {
      stack.push(name);
    }
  }

  const uniqueNames = [...occurrences.keys()].sort();

  return {
    totalOptions: [...occurrences.values()].reduce((sum, count) => sum + count, 0),
    uniqueNames,
    occurrences: Object.fromEntries([...occurrences.entries()].sort(([a], [b]) => a.localeCompare(b))),
    samplePaths: Object.fromEntries([...samplePaths.entries()].sort(([a], [b]) => a.localeCompare(b))),
    pathsByName: Object.fromEntries([...pathsByName.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

export function auditThemeCoverageMappings(xmlContent: string): ThemeCoverageReport {
  const index = extractIclsOptionNames(xmlContent);
  const mappedNames = mappedIclsOptionNames();
  const unmapped = index.uniqueNames
    .filter((name) => !mappedNames.has(name))
    .map((name) => ({
      name,
      occurrences: index.occurrences[name] ?? 0,
      samplePaths: index.samplePaths[name] ?? [],
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));

  return {
    totalOptions: index.totalOptions,
    uniqueOptionNames: index.uniqueNames.length,
    mapped: [...mappedNames].filter((name) => index.uniqueNames.includes(name)).sort(),
    unmapped,
    top50Unmapped: unmapped.slice(0, 50),
    classifiedChildLeaves: classifyChildLeaves(index),
    classifiedTopLevelOptions: classifyTopLevelOptions(index),
  };
}

export function writeThemeCoverageReport(
  xmlContent: string,
  outFile = "proof/theme-coverage.json",
): ThemeCoverageReport {
  const report = auditThemeCoverageMappings(xmlContent);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

function classifyChildLeaves(index: IclsOptionNameIndex): ThemeCoverageChildLeafReport[] {
  const targetsByPath = themeCoverageAuditTargets();

  return classifiedChildLeafNames.map((name) => {
    const mappedPaths: ThemeCoverageMappedPath[] = [];
    const deferredPaths: ThemeCoverageDeferredPath[] = [];

    for (const path of index.pathsByName[name] ?? []) {
      const monacoTargets = targetsByPath[path];
      if (monacoTargets) {
        mappedPaths.push({ path, monacoTargets });
      } else {
        deferredPaths.push({ path, reason: deferredReason(path) });
      }
    }

    return {
      name,
      occurrences: index.occurrences[name] ?? 0,
      mappedPaths,
      deferredPaths,
    };
  });
}

function classifyTopLevelOptions(index: IclsOptionNameIndex): ThemeCoverageChildLeafReport[] {
  const targetsByPath = themeCoverageAuditTargets();

  return classifiedTopLevelOptionNames.map((name) => {
    const mappedPaths: ThemeCoverageMappedPath[] = [];
    const deferredPaths: ThemeCoverageDeferredPath[] = [];

    for (const path of classifiedTopLevelPathsFor(name)) {
      const monacoTargets = targetsByPath[path];
      if (monacoTargets) {
        mappedPaths.push({ path, monacoTargets });
      } else {
        deferredPaths.push({ path, reason: classifiedTopLevelDeferredReason(path) });
      }
    }

    return {
      name,
      occurrences: index.occurrences[name] ?? 0,
      mappedPaths,
      deferredPaths,
    };
  });
}

function classifiedTopLevelPathsFor(name: string): string[] {
  if (name === "ABSTRACT_CLASS_NAME_ATTRIBUTES") {
    return ["ABSTRACT_CLASS_NAME_ATTRIBUTES.FOREGROUND", "ABSTRACT_CLASS_NAME_ATTRIBUTES.FONT_TYPE"];
  }

  if (name === "BAD_CHARACTER") {
    return ["BAD_CHARACTER.FOREGROUND", "BAD_CHARACTER.BACKGROUND", "BAD_CHARACTER.ERROR_STRIPE_COLOR", "BAD_CHARACTER.EFFECT_TYPE"];
  }

  if (name === "BRACE_ATTR") {
    return ["BRACE_ATTR.FOREGROUND", "BRACE_ATTR.BACKGROUND", "BRACE_ATTR.FONT_TYPE", "BRACE_ATTR.EFFECT_TYPE"];
  }

  if (name === "BRACKET_ATTR") {
    return ["BRACKET_ATTR.FOREGROUND", "BRACKET_ATTR.BACKGROUND", "BRACKET_ATTR.FONT_TYPE"];
  }

  if (name === "BREADCRUMBS_CURRENT" || name === "BREADCRUMBS_HOVERED") {
    return [`${name}.FOREGROUND`, `${name}.BACKGROUND`];
  }

  if (name === "CLASS_NAME_ATTRIBUTES" || name === "CLASS_REFERENCE" || name === "BUILDOUT.KEY_VALUE_SEPARATOR" || name === "BUILDOUT.SECTION_NAME") {
    return [`${name}.FOREGROUND`];
  }

  if (name === "BUILDOUT.KEY" || name === "BUILDOUT.LINE_COMMENT" || name === "C.KEYWORD") {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  if (name === "BUILDOUT.VALUE") {
    return ["BUILDOUT.VALUE.FONT_TYPE"];
  }

  if (name.startsWith("APACHE_CONFIG.")) {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  if (name === "BASH.EXTERNAL_COMMAND") {
    return ["BASH.EXTERNAL_COMMAND.FOREGROUND"];
  }

  if (name === "BASH.HERE_DOC") {
    return ["BASH.HERE_DOC"];
  }

  if (name === "BLOCK_TERMINAL_COMMAND") {
    return ["BLOCK_TERMINAL_COMMAND.FOREGROUND", "BLOCK_TERMINAL_COMMAND.FONT_TYPE"];
  }

  if (name.startsWith("COFFEESCRIPT.")) {
    return coffeeScriptPathsFor(name);
  }

  if (name.startsWith("CONSTRUCTOR_")) {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  if (name.startsWith("CPP.")) {
    return cppPathsFor(name);
  }

  if (name.startsWith("CONSOLE_")) {
    return consolePathsFor(name);
  }

  if (name === "CONDITIONALLY_NOT_COMPILED") {
    return ["CONDITIONALLY_NOT_COMPILED.FOREGROUND"];
  }

  if (name.startsWith("CSS.")) {
    return cssPathsFor(name);
  }

  return [name];
}

function cppPathsFor(name: string): string[] {
  if (["CPP.BLOCK_COMMENT", "CPP.KEYWORD", "CPP.LINE_COMMENT", "CPP.STRING"].includes(name)) {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  if (["CPP.DOT", "CPP.MACROS", "CPP.NUMBER", "CPP.OPERATION_SIGN", "CPP.PP_ARG"].includes(name)) {
    return [`${name}.FOREGROUND`];
  }

  if (name === "CPP.UNUSED") {
    return ["CPP.UNUSED.EFFECT_TYPE"];
  }

  if (name === "CPP.PARAMETER") {
    return ["CPP.PARAMETER.FOREGROUND", "CPP.PARAMETER.EFFECT_TYPE"];
  }

  if (["CPP.CONSTANT", "CPP.FIELD", "CPP.METHOD", "CPP.NAMESPACE", "CPP.PP_SKIPPED", "CPP.STATIC", "CPP.STATIC_FUNCTION"].includes(name)) {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  return [`${name}.FOREGROUND`];
}

function cssPathsFor(name: string): string[] {
  if (["CSS.COMMENT", "CSS.IMPORTANT", "CSS.KEYWORD"].includes(name)) {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  if (["CSS.FUNCTION", "CSS.IDENT", "CSS.PROPERTY_VALUE"].includes(name)) {
    return [`${name}.FOREGROUND`];
  }

  return [`${name}.FOREGROUND`];
}

function consolePathsFor(name: string): string[] {
  if (["CONSOLE_BACKGROUND_KEY", "CONSOLE_FONT_NAME", "CONSOLE_FONT_SIZE", "CONSOLE_LINE_SPACING", "CONSOLE_DARKGRAY_OUTPUT"].includes(name)) {
    return [name];
  }

  if (name === "CONSOLE_USER_INPUT") {
    return ["CONSOLE_USER_INPUT.FOREGROUND", "CONSOLE_USER_INPUT.FONT_TYPE"];
  }

  return [`${name}.FOREGROUND`];
}

function coffeeScriptPathsFor(name: string): string[] {
  if (name === "COFFEESCRIPT.BAD_CHARACTER") {
    return [
      "COFFEESCRIPT.BAD_CHARACTER.FOREGROUND",
      "COFFEESCRIPT.BAD_CHARACTER.BACKGROUND",
      "COFFEESCRIPT.BAD_CHARACTER.ERROR_STRIPE_COLOR",
    ];
  }

  if (name === "COFFEESCRIPT.JAVASCRIPT_ID") {
    return [
      "COFFEESCRIPT.JAVASCRIPT_ID.FOREGROUND",
      "COFFEESCRIPT.JAVASCRIPT_ID.BACKGROUND",
      "COFFEESCRIPT.JAVASCRIPT_ID.FONT_TYPE",
    ];
  }

  if (name === "COFFEESCRIPT.HEREDOC_CONTENT") {
    return ["COFFEESCRIPT.HEREDOC_CONTENT.FONT_TYPE"];
  }

  if ([
    "COFFEESCRIPT.BLOCK_COMMENT",
    "COFFEESCRIPT.BOOLEAN",
    "COFFEESCRIPT.HEREDOC_ID",
    "COFFEESCRIPT.HEREGEX_ID",
    "COFFEESCRIPT.LINE_COMMENT",
    "COFFEESCRIPT.REGULAR_EXPRESSION_FLAG",
    "COFFEESCRIPT.REGULAR_EXPRESSION_ID",
    "COFFEESCRIPT.STRING_LITERAL",
    "COFFEESCRIPT.THIS",
  ].includes(name)) {
    return [`${name}.FOREGROUND`, `${name}.FONT_TYPE`];
  }

  return [`${name}.FOREGROUND`];
}

function classifiedTopLevelDeferredReason(path: string): string {
  if (path === "ANNOTATION_NAME_ATTRIBUTES") {
    return "defer: Java annotation highlighting is not loaded; TypeScript decorators are covered by TS.DECORATOR";
  }

  if (path === "ANNOTATIONS_COLOR" || path === "ANNOTATIONS_MERGED_COLOR") {
    return "defer: VCS annotate/blame UI is not implemented in Maldives yet";
  }

  if (path === "BOOKMARKS_ATTRIBUTES") {
    return "defer: bookmarks UI is not implemented in Maldives yet";
  }

  if (path === "BREAKPOINT_ATTRIBUTES") {
    return "defer: breakpoints require the later debug subsystem before their glyph colors have a live Monaco surface";
  }

  if (path === "BAD_CHARACTER.EFFECT_TYPE") {
    return "unsupported: Monaco themes do not expose WebStorm effect-type styles for bad-character highlights";
  }

  if (path === "BREADCRUMBS_HOVERED.BACKGROUND") {
    return "unsupported: Monaco breadcrumbs expose focus foreground but no separate hovered-item background color";
  }

  if (path.startsWith("APACHE_CONFIG.")) {
    return "defer: Monaco/Maldives does not load an Apache config language grammar yet";
  }

  if (path === "BASH.HERE_DOC") {
    return "unsupported: active ICLS BASH.HERE_DOC has no foreground or font style to apply";
  }

  if (path.startsWith("BLOCK_TERMINAL_COMMAND.")) {
    return "defer: terminal command block highlighting waits for the P23 terminal/editor-block subsystem; no Monaco grammar emits this token today";
  }

  if (path.startsWith("COFFEESCRIPT.")) {
    return coffeeScriptDeferredReason(path);
  }

  if (path.startsWith("CONSTRUCTOR_")) {
    return constructorDeferredReason(path);
  }

  if (path.startsWith("CPP.")) {
    return cppDeferredReason(path);
  }

  if (path === "CONSOLE_DARKGRAY_OUTPUT") {
    return "unsupported: active ICLS CONSOLE_DARKGRAY_OUTPUT has no foreground or font style to apply";
  }

  if (path.startsWith("CSS.")) {
    return cssDeferredReason(path);
  }

  if (path.startsWith("CONDITIONALLY_NOT_COMPILED.")) {
    return "defer: Monaco/Maldives does not load a preprocessor inactive-code surface for conditionally-not-compiled regions yet";
  }

  if (path.endsWith(".BACKGROUND")) {
    return "unsupported: Monaco token theme rules do not expose per-token backgrounds for this attribute";
  }

  if (path.endsWith(".EFFECT_TYPE")) {
    return "unsupported: Monaco themes do not expose WebStorm effect-type styles for this attribute";
  }

  return "defer: no concrete Monaco token or UI surface has been selected for this ICLS attribute yet";
}

function constructorDeferredReason(path: string): string {
  if (path.startsWith("CONSTRUCTOR_CALL_ATTRIBUTES.")) {
    return "unsupported: Monaco's loaded grammars do not emit a distinct constructor-call token";
  }

  return "unsupported: Monaco's loaded grammars do not emit a distinct constructor-declaration token";
}

function cssDeferredReason(path: string): string {
  if (path.startsWith("CSS.FUNCTION.")) {
    return "unsupported: Monaco's CSS grammar emits functions as generic attribute values, colliding with CSS property values";
  }

  if (path.startsWith("CSS.IDENT.")) {
    return "unsupported: Monaco's CSS grammar emits class/id selectors as generic tag tokens, not distinct identifiers";
  }

  if (path.startsWith("CSS.PROPERTY_VALUE.")) {
    return "unsupported: Monaco's CSS grammar emits generic property values with the same token as functions/units";
  }

  if (path.endsWith(".EFFECT_TYPE")) {
    return "unsupported: Monaco themes do not expose WebStorm effect-type styles for CSS attributes";
  }

  return "defer: no concrete Monaco token or UI surface has been selected for this CSS ICLS attribute yet";
}

function cppDeferredReason(path: string): string {
  if (path.endsWith(".EFFECT_TYPE")) {
    return "unsupported: Monaco themes do not expose WebStorm effect-type styles for this C++ attribute";
  }

  if (path.endsWith(".BACKGROUND")) {
    return "unsupported: Monaco token theme rules do not expose per-token backgrounds for this C++ attribute";
  }

  const cppName = path.split(".").slice(0, 2).join(".");
  const labels: Record<string, string> = {
    "CPP.CONSTANT": "constant",
    "CPP.FIELD": "field",
    "CPP.FUNCTION": "function",
    "CPP.LABEL": "label",
    "CPP.METHOD": "method",
    "CPP.NAMESPACE": "namespace",
    "CPP.PARAMETER": "parameter",
    "CPP.PP_SKIPPED": "preprocessor-skipped",
    "CPP.STATIC": "static-member",
    "CPP.STATIC_FUNCTION": "static-function",
    "CPP.TYPE": "type",
  };
  const label = labels[cppName] ?? "attribute";

  return `unsupported: Monaco's C++ Monarch grammar emits ${label}s as generic identifiers, not a distinct ${label} token`;
}

function coffeeScriptDeferredReason(path: string): string {
  if (path.endsWith(".BACKGROUND")) {
    return "unsupported: Monaco token theme rules do not expose per-token backgrounds for this attribute";
  }

  if (path.endsWith(".ERROR_STRIPE_COLOR")) {
    return "unsupported: Maldives has no Monaco overview-ruler equivalent for this WebStorm stripe attribute";
  }

  if (path.startsWith("COFFEESCRIPT.CLASS_NAME.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not emit a distinct class-name token";
  }

  if (path.startsWith("COFFEESCRIPT.FUNCTION_NAME.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not emit a distinct function-name token";
  }

  if (path.startsWith("COFFEESCRIPT.GLOBAL_VARIABLE.") || path.startsWith("COFFEESCRIPT.LOCAL_VARIABLE.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not distinguish local/global variable identifiers";
  }

  if (path.startsWith("COFFEESCRIPT.HEREDOC_CONTENT.")) {
    return "unsupported: Monaco's CoffeeScript grammar emits heredoc contents as the generic string token";
  }

  if (path.startsWith("COFFEESCRIPT.HEREDOC_ID.") || path.startsWith("COFFEESCRIPT.HEREGEX_ID.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not emit distinct heredoc or heregex delimiter tokens";
  }

  if (path.startsWith("COFFEESCRIPT.JAVASCRIPT_ID.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not emit a distinct embedded-JavaScript delimiter token";
  }

  if (path.startsWith("COFFEESCRIPT.OBJECT_KEY.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not emit a distinct object-key token";
  }

  if (path.startsWith("COFFEESCRIPT.REGULAR_EXPRESSION_FLAG.") || path.startsWith("COFFEESCRIPT.REGULAR_EXPRESSION_ID.")) {
    return "unsupported: Monaco's CoffeeScript grammar emits regex flags and delimiters as the generic regexp token";
  }

  if (path.startsWith("COFFEESCRIPT.STRING_LITERAL.")) {
    return "unsupported: Monaco's CoffeeScript grammar does not distinguish literal string token variants";
  }

  return "defer: no concrete Monaco token or UI surface has been selected for this CoffeeScript ICLS attribute yet";
}

function deferredReason(path: string): string {
  const leaf = path.split(".").at(-1);
  const parent = path.slice(0, -(leaf?.length ?? 0) - 1);

  if (leaf === "EFFECT_TYPE") {
    return "unsupported: Monaco themes do not expose WebStorm effect-type styles for this attribute";
  }

  if (leaf === "BACKGROUND") {
    return "unsupported: Monaco token theme rules do not expose per-token backgrounds for this attribute";
  }

  if (leaf === "ERROR_STRIPE_COLOR") {
    return "unsupported: Maldives has no Monaco overview-ruler equivalent for this WebStorm stripe attribute";
  }

  if (parent.startsWith("COFFEESCRIPT")) {
    return coffeeScriptDeferredReason(path);
  }

  if (parent.startsWith("CONSTRUCTOR_")) {
    return constructorDeferredReason(path);
  }

  if (parent.startsWith("CPP")) {
    return cppDeferredReason(path);
  }

  if (parent.startsWith("CSS")) {
    return cssDeferredReason(path);
  }

  if (parent.startsWith("APACHE_CONFIG") || parent.startsWith("BASH")) {
    return "defer: Maldives does not load this language grammar yet";
  }

  return "defer: no concrete Monaco token or UI surface has been selected for this ICLS attribute yet";
}

function mappedIclsOptionNames(): Set<string> {
  const mapped = new Set<string>();

  for (const attribute of themeCoverageAuditAttributes) {
    mapped.add(attribute);
    mapped.add(attribute.split(".")[0]);
  }

  for (const childLeaf of classifiedChildLeafNames) {
    mapped.add(childLeaf);
  }

  for (const optionName of classifiedTopLevelOptionNames) {
    mapped.add(optionName);
  }

  return mapped;
}

if (import.meta.main) {
  const outIndex = process.argv.indexOf("--out");
  const outFile = outIndex === -1 ? "proof/theme-coverage.json" : process.argv[outIndex + 1];
  const report = writeThemeCoverageReport(readFileSync("ssot/colors/active-theme.icls", "utf-8"), outFile);

  console.log(
    `theme coverage: mapped=${report.mapped.length} unmapped=${report.unmapped.length} totalOptions=${report.totalOptions}`,
  );
}
