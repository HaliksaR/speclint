#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Root } from "./model.js";
import { loadOpenSpec } from "./openspec.js";
import { fromManifest, toManifest } from "./manifest.js";
import { check, type Dependency } from "./rules.js";
import { loadMarks } from "./tests.js";
import { mutate } from "./mutate.js";
import { impact } from "./impact.js";
import { exitCode, jsonReport, RULES, textReport, type Finding } from "./report.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const fail = (message: string): never => {
  process.stderr.write(`speclint: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
let format = "text";
let path = ".";
let manifest = false;
let mutating = false;
let impacting = false;
let range: string | null = null;
let rebuild = false;
let scope = "";
let budget = 3;
let release: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (i === 0 && arg === "manifest") manifest = true;
  else if (i === 0 && arg === "mutate") mutating = true;
  else if (i === 0 && arg === "impact") impacting = true;
  else if (impacting && arg === "--diff") range = args[++i] ?? "";
  else if (impacting && arg === "--rebuild") rebuild = true;
  else if (mutating && arg === "--scope") scope = args[++i] ?? "";
  else if (mutating && arg === "--budget") budget = Number(args[++i]);
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

type Config = { roots: Root[]; tests: string[] | null; dependencies: Record<string, any>; rules: Record<string, string>; textChecks: string[]; behaviourChecks: string[] };

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
  const rules = config.rules ?? {};
  if (typeof rules !== "object" || Array.isArray(rules)) fail("нечитаемая конфигурация: speclint.json: rules — { <правило>: off | error | warning | info }");
  for (const [rule, level] of Object.entries(rules)) {
    if (!RULES.includes(rule)) fail(`нечитаемая конфигурация: speclint.json: rules: неизвестное правило ${rule}`);
    if (!["off", "error", "warning", "info"].includes(level as string)) fail(`нечитаемая конфигурация: speclint.json: rules: ${rule} — off, error, warning или info`);
  }
  const known = [...spaces, ...Object.keys(dependencies)];
  const context = (r: any) =>
    (r.class === undefined || ["core", "supporting", "generic"].includes(r.class)) &&
    (r.uses === undefined || (Array.isArray(r.uses) && r.uses.every((u: any) => known.includes(u) && u !== r.space)));
  if (!roots.every(context)) fail("нечитаемая конфигурация: speclint.json: roots: class — core, supporting или generic; uses — пространства корней или dependencies");
  const strings = (v: any) => Array.isArray(v) && v.every((t) => typeof t === "string" && t);
  const textChecks = config.textChecks ?? [];
  const behaviourChecks = config.behaviourChecks ?? [];
  if (!strings(textChecks) || !strings(behaviourChecks)) fail("нечитаемая конфигурация: speclint.json: textChecks и behaviourChecks — список строк");
  return { roots: roots.map((r) => ({ path: r.path, space: r.space, class: r.class, uses: r.uses })), tests, dependencies, rules, textChecks, behaviourChecks };
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
const { roots, tests, dependencies, rules, textChecks, behaviourChecks }: Config = existsSync(config)
  ? readConfig(config)
  : { roots: [{ path: "openspec", space: null }], tests: null, dependencies: {}, rules: {}, textChecks: [], behaviourChecks: [] };
if (manifest) {
  if (!release) fail("speclint manifest: нужен --release <версия>");
  const unnamed = roots.find((r) => !r.space);
  if (unnamed) fail(`у корня ${unnamed.path} нет пространства: задайте roots в speclint.json`);
}
const deps = manifest ? [] : Object.entries(dependencies).map(([space, d]) => loadDependency(space, d));
const corpora = roots.map((root) => loadOpenSpec(path, root) ?? fail(`корень не найден: ${path}/${root.path}`));
const { marks, files: testFiles, literals } = loadMarks(path, roots, tests, textChecks, behaviourChecks);
const { findings: all, covered } = check(corpora, marks, deps, literals);
const findings = all.filter((f) => rules[f.rule] !== "off").map((f) => (rules[f.rule] ? { ...f, level: rules[f.rule] as Finding["level"] } : f));
if (impacting) {
  const r = impact(path, corpora, marks, range, rebuild) ?? fail(`speclint impact: git diff ${range ?? "HEAD"} не выполнился`);
  process.stdout.write(
    format === "json"
      ? `${JSON.stringify({ tool: "speclint", version, diff: range ?? "HEAD", ...r }, null, 2)}\n`
      : [
          ...r.contexts.map((c) => `контекст ${c.space ?? "-"}${c.class ? ` (${c.class})` : ""}: сценариев ${c.scenarios}\n`),
          ...r.scenarios.map((s) => `spec:${s.address} ← ${s.reasons.join(", ")}\n`),
          ...r.findings.map((f) => `${f.level} ${f.rule}: ${f.message}\n`),
          `speclint impact: контекстов ${r.contexts.length}, модулей ${r.modules.length} (${r.modules.join(", ")}), сценариев ${r.scenarios.length}\n`,
        ].join(""),
  );
} else if (mutating) {
  if (!Number.isInteger(budget) || budget < 1) fail("speclint mutate: --budget — целое число больше нуля");
  const scenarios = mutate(path, corpora, marks, scope, budget);
  const lost = scenarios.filter((s) => s.survived.length);
  process.stdout.write(
    format === "json"
      ? `${JSON.stringify({ tool: "speclint", version, scenarios }, null, 2)}\n`
      : scenarios.flatMap((s) => s.survived.map((m) => `${m}: мутация пережила тесты сценария ${s.address} (${s.tests.join(", ")})\n`)).join("") +
          `speclint mutate: сценариев ${scenarios.length}, убито мутаций ${scenarios.reduce((n, s) => n + s.killed, 0)}, выжило ${lost.reduce((n, s) => n + s.survived.length, 0)}\n`,
  );
  process.exitCode = lost.length ? 1 : 0;
} else if (manifest) {
  process.stdout.write(`${toManifest(corpora, covered, marks, release!)}\n`);
} else {
  const files = corpora.reduce((n, c) => n + c.files, testFiles + new Set(deps.filter((d) => d.corpus).map((d) => d.corpus!.root.path)).size);
  process.stdout.write(`${format === "json" ? jsonReport(version, findings, files) : textReport(findings, files)}\n`);
  process.exitCode = exitCode(findings);
}
