import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exitCode } from "../src/report.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const cli = (...args: string[]) =>
  spawnSync("node", [new URL("../dist/cli.js", import.meta.url).pathname, ...args], { encoding: "utf8" });

describe("speclint CLI", () => {
  it("prints the package version and exits 0", () => {
    const r = cli("--version");
    expect(r.stdout.trim()).toBe(pkg.version);
    expect(r.status).toBe(0);
  });

  it("exits 2 on an unknown flag", () => {
    const r = cli("--profil");
    expect(r.stderr).toContain("--profil");
    expect(r.status).toBe(2);
  });

  it("exits 2 on an unknown format", () => {
    expect(cli("--format", "xml").status).toBe(2);
  });

  it("prints an empty JSON report for a clean repository and exits 0", () => {
    const r = cli(new URL("./fixtures/clean", import.meta.url).pathname, "--format", "json");
    expect(JSON.parse(r.stdout)).toEqual({
      tool: "speclint",
      version: pkg.version,
      status: "ok",
      findings: [],
      summary: { errors: 0, warnings: 0, infos: 0, files: 7 },
    });
    expect(r.status).toBe(0);
  });
});

describe("exit code", () => {
  const finding = (level: "error" | "warning" | "info") =>
    ({ level, rule: "r", file: null, line: null, message: "m", related: [] });

  it("is 0 when there are only warnings and infos", () => {
    expect(exitCode([finding("warning"), finding("info")])).toBe(0);
  });

  it("is 1 when there is an error", () => {
    expect(exitCode([finding("warning"), finding("error")])).toBe(1);
  });
});

describe("output to a pipe", () => {
  it("writes a JSON report larger than the pipe buffer in full", () => {
    const dir = mkdtempSync(join(tmpdir(), "speclint-"));
    mkdirSync(join(dir, "openspec/specs/app"), { recursive: true });
    writeFileSync(join(dir, "openspec/specs/app/spec.md"), "# app\n\n## Requirements\n");
    writeFileSync(join(dir, "openspec/notes.md"), Array.from({ length: 2000 }, (_, i) => `spec:app/missing-${i}\n`).join(""));
    const r = cli(dir, "--format", "json");
    expect(r.stdout.length).toBeGreaterThan(65536);
    expect(JSON.parse(r.stdout).summary.errors).toBe(2000);
    expect(r.status).toBe(1);
  });
});
