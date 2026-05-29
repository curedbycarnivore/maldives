#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { themeCoverageAuditAttributes } from "../src/theme/coverage-audit";

export interface IclsOptionNameIndex {
  totalOptions: number;
  uniqueNames: string[];
  occurrences: Record<string, number>;
  samplePaths: Record<string, string[]>;
}

export interface ThemeCoverageUnmappedEntry {
  name: string;
  occurrences: number;
  samplePaths: string[];
}

export interface ThemeCoverageReport {
  totalOptions: number;
  uniqueOptionNames: number;
  mapped: string[];
  unmapped: ThemeCoverageUnmappedEntry[];
  top50Unmapped: ThemeCoverageUnmappedEntry[];
}

export function extractIclsOptionNames(xmlContent: string): IclsOptionNameIndex {
  const occurrences = new Map<string, number>();
  const samplePaths = new Map<string, string[]>();
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
    const paths = samplePaths.get(name) ?? [];
    if (paths.length < 5) {
      paths.push([...stack, name].join("."));
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

function mappedIclsOptionNames(): Set<string> {
  const mapped = new Set<string>();

  for (const attribute of themeCoverageAuditAttributes) {
    mapped.add(attribute);
    mapped.add(attribute.split(".")[0]);
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
