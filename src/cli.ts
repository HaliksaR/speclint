#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Root } from "./model.js";
import { loadOpenSpec } from "./openspec.js";
import { fromManifest, toManifest } from "./manifest.js";
import { check, type Dependency } from "./rules.js";
import { loadMarks } from "./tests.js";
import { exitCode, jsonReport, textReport } from "./report.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const fail = (message: string): never => {
  process.stderr.write(`speclint: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
let format = "text";
let path = ".";
let manifest = false;
let release: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (i === 0 && arg === "manifest") manifest = true;
  else if (manifest && arg === "--release") release = args[++i];
  else if (arg === "--version") {
    process.stdout.write(`${version}\n`);
    process.exit(0);
  } else if (arg === "--format") {
    format = args[++i];
    if (format !== "text" && format !== "json") fail(`неизвестный формат: ${format}`);
  } else if (arg.startsWith("-")) {
    fail(`неизвестный флаг: ${arg}`);
  } else {
    path = arg;
  }
}

type Config = { roots: Root[]; tests: string[] | null; dependencies: Record<string, any> };

const readConfig = (file: string): Config => {
  let config;
  try {
    config = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return fail(`нечитаемая конфигурация: speclint.json: ${(e as Error).message}`);
  }
  const roots = config?.roots;
  const valid = (r: any) => typeof r?.path === "string" && typeof r.space === "string" && /^[a-z0-9-]+$/.test(r.space);
  if (!Array.isArray(roots) || !roots.length || !roots.every(valid))
    return fail("нечитаемая конфигурация: speclint.json: roots — непустой список { path, space }, space из [a-z0-9-]");
  const spaces = roots.map((r) => r.space);
  const twice = spaces.find((s, i) => spaces.indexOf(s) !== i);
  if (twice) fail(`нечитаемая конфигурация: speclint.json: пространство ${twice} у двух корней`);
  const tests = config.tests ?? null;
  if (tests !== null && (!Array.isArray(tests) || !tests.every((t) => typeof t === "string")))
    fail("нечитаемая конфигурация: speclint.json: tests — список glob-шаблонов");
  const dependencies = config.dependencies ?? {};
  const dependency = (d: any) => d?.unchecked === true || (typeof d?.manifest === "string" && typeof d.version === "string");
  if (typeof dependencies !== "object" || Array.isArray(dependencies) || !Object.values(dependencies).every(dependency))
    fail("нечитаемая конфигурация: speclint.json: dependencies — { <space>: { manifest, version } | { unchecked: true } }");
  return { roots: roots.map((r) => ({ path: r.path, space: r.space })), tests, dependencies };
};

const loadDependency = (space: string, d: any): Dependency => {
  const none = { space, label: `${space} ${d.version}`, unchecked: d.unchecked === true, missing: null, corpus: null, covered: new Set<string>(), marks: [] };
  if (none.unchecked) return none;
  const file = join(path, d.manifest);
  if (!existsSync(file)) return { ...none, missing: `манифест ${space} не найден: ${d.manifest}` };
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return fail(`нечитаемый манифест ${space}: ${d.manifest}: ${(e as Error).message}`);
  }
  if (json?.speclint !== 1 && json?.speclint !== 2) fail(`манифест ${space}: формат ${json?.speclint}, ожидается 1 или 2`);
  if (json.version !== d.version) fail(`манифест ${space}: версия ${json.version}, зафиксирована ${d.version}`);
  const loaded = fromManifest(json, space, d.manifest);
  return loaded ? { ...none, ...loaded } : { ...none, missing: `в манифесте ${d.manifest} нет пространства ${space}` };
};

const config = join(path, "speclint.json");
const { roots, tests, dependencies }: Config = existsSync(config)
  ? readConfig(config)
  : { roots: [{ path: "openspec", space: null }], tests: null, dependencies: {} };
if (manifest) {
  if (!release) fail("speclint manifest: нужен --release <версия>");
  const unnamed = roots.find((r) => !r.space);
  if (unnamed) fail(`у корня ${unnamed.path} нет пространства: задайте roots в speclint.json`);
}
const deps = manifest ? [] : Object.entries(dependencies).map(([space, d]) => loadDependency(space, d));
const corpora = roots.map((root) => loadOpenSpec(path, root) ?? fail(`корень не найден: ${path}/${root.path}`));
const { marks, files: testFiles, literals } = loadMarks(path, roots, tests);
const { findings, covered } = check(corpora, marks, deps, literals);
if (manifest) {
  process.stdout.write(`${toManifest(corpora, covered, marks, release!)}\n`);
  process.exit(0);
}
const files = corpora.reduce((n, c) => n + c.files, testFiles + new Set(deps.filter((d) => d.corpus).map((d) => d.corpus!.root.path)).size);
process.stdout.write(`${format === "json" ? jsonReport(version, findings, files) : textReport(findings, files)}\n`);
process.exit(exitCode(findings));
