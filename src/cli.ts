#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { exitCode, jsonReport, textReport, type Finding } from "./report.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

const fail = (message: string): never => {
  process.stderr.write(`speclint: ${message}\n`);
  process.exit(2);
};

const args = process.argv.slice(2);
let format = "text";
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
  }
}

const findings: Finding[] = [];
process.stdout.write(`${format === "json" ? jsonReport(version, findings, 0) : textReport(findings, 0)}\n`);
process.exit(exitCode(findings));
