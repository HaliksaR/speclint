#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Root } from "./model.js";
import { loadOpenSpec } from "./openspec.js";
import { check } from "./rules.js";
import { loadMarks } from "./tests.js";
import { exitCode, jsonReport, textReport, type Finding } from "./report.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const fail = (message: string): never => {
  process.stderr.write(`speclint: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
let format = "text";
let path = ".";
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--version") {
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

const readConfig = (file: string): { roots: Root[]; tests: string[] | null } => {
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
  return { roots: roots.map((r) => ({ path: r.path, space: r.space })), tests };
};

const config = join(path, "speclint.json");
const { roots, tests } = existsSync(config) ? readConfig(config) : { roots: [{ path: "openspec", space: null }], tests: null };
const corpora = roots.map((root) => loadOpenSpec(path, root) ?? fail(`корень не найден: ${path}/${root.path}`));
const { marks, files: testFiles } = loadMarks(path, roots, tests);
const files = corpora.reduce((n, c) => n + c.files, testFiles);
const findings: Finding[] = check(corpora, marks);
process.stdout.write(`${format === "json" ? jsonReport(version, findings, files) : textReport(findings, files)}\n`);
process.exit(exitCode(findings));
