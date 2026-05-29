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

  if (parent.startsWith("APACHE_CONFIG") || parent.startsWith("BASH") || parent.startsWith("COFFEESCRIPT")) {
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
