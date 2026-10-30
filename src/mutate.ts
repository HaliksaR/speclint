import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import type { Corpus, TestMark } from "./model.js";

type Scenario = { address: string; keys: string[]; tests: { dir: string; file: string; name: string }[] };
type Site = { dir: string; file: string; line: number; text: string };

const testName = (lines: string[], from: number) => {
  for (let i = from; i < lines.length; i++) {
    if (/^\s*\/\//.test(lines[i])) continue;
    return lines[i].match(/^func (Test\w+)\(/)?.[1] ?? null;
  }
  return null;
};

const goTest = (cwd: string, names: string[], profile?: string) =>
  spawnSync("go", ["test", "-count=1", "-run", `^(${names.join("|")})$`, ...(profile ? [`-coverprofile=${profile}`] : []), "."], { cwd, encoding: "utf8" });

const covered = (base: string, dir: string, names: string[]) => {
  const profile = join(mkdtempSync(join(tmpdir(), "speclint-")), "cover.out");
  const r = goTest(join(base, dir), names, profile);
  if (r.status !== 0) return null;
  const lines = new Set<string>();
  for (const row of readFileSync(profile, "utf8").split("\n").slice(1)) {
    const m = row.match(/\/([^/]+\.go):(\d+)\.\d+,(\d+)\.\d+ \d+ (\d+)$/);
    if (!m || m[4] === "0") continue;
    for (let l = Number(m[2]); l <= Number(m[3]); l++) lines.add(`${m[1]}:${l}`);
  }
  return lines;
};

const sites = (base: string, dir: string, lines: Set<string>): Site[] =>
  readdirSync(join(base, dir))
    .filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"))
    .flatMap((f) =>
      readFileSync(join(base, dir, f), "utf8")
        .split("\n")
        .flatMap((text, i) =>
          lines.has(`${f}:${i + 1}`) && /^\s*if [^;]+\{\s*$/.test(text) && !/err [!=]= nil/.test(text)
            ? [{ dir, file: f, line: i + 1, text }]
            : [],
        ),
    );

const mutant = (text: string) => text.replace(/^(\s*)if (.+?)\s*\{\s*$/, "$1if !($2) {");

const withMutant = (path: string, line: number, run: () => ReturnType<typeof goTest>) => {
  const original = readFileSync(path, "utf8");
  const lines = original.split("\n");
  lines[line - 1] = mutant(lines[line - 1]);
  writeFileSync(path, lines.join("\n"));
  try {
    const r = run();
    return { status: r.status === 0 ? "survived" : /build failed|\[setup failed\]/.test(r.stdout + r.stderr) ? "broken" : "killed", text: lines[line - 1].trim() };
  } finally {
    writeFileSync(path, original);
  }
};

const goPackage = (cwd: string) => spawnSync("go", ["test", "-count=1", "."], { cwd, encoding: "utf8" });

export const mutate = (base: string, corpora: Corpus[], marks: TestMark[], scope: string, budget: number) => {
  const prefix = (c: Corpus) => (corpora.length > 1 && c.root.space ? `${c.root.space}:` : "");
  const scenarios: Scenario[] = corpora.flatMap((c) =>
    c.requirements.flatMap((r) =>
      r.scenarios.map((s) => {
        const req = `${prefix(c)}${r.capability.id}/${r.slug}`;
        return { address: `${req}#${s.slug}`, keys: [req, `${req}#${s.slug}`], tests: [] as Scenario["tests"] };
      }),
    ),
  ).filter((s) => s.address.startsWith(scope));
  const sources = new Map<string, string[]>();
  for (const mark of marks) {
    if (!mark.file.endsWith("_test.go")) continue;
    const lines = sources.get(mark.file) ?? readFileSync(join(base, mark.file), "utf8").split("\n");
    sources.set(mark.file, lines);
    const name = testName(lines, mark.line);
    if (!name) continue;
    for (const s of scenarios)
      if (s.keys.includes(mark.address) && !s.tests.some((t) => t.file === mark.file && t.name === name))
        s.tests.push({ dir: posix.dirname(mark.file), file: mark.file, name });
  }
  const tested = scenarios.filter((s) => s.tests.length);
  const cover = new Map(tested.map((s) => [s, s.tests.length ? covered(base, s.tests[0].dir, s.tests.map((t) => t.name)) : null]));
  const shared = new Map<string, number>();
  for (const lines of cover.values()) for (const l of lines ?? []) shared.set(l, (shared.get(l) ?? 0) + 1);
  const results = tested.map((s) => {
    const lines = cover.get(s);
    const dir = s.tests[0].dir;
    const picked = lines
      ? sites(base, dir, lines)
          .sort((a, b) => shared.get(`${a.file}:${a.line}`)! - shared.get(`${b.file}:${b.line}`)! || a.file.localeCompare(b.file) || a.line - b.line)
          .slice(0, budget)
      : [];
    let killed = 0;
    const survived: Site[] = [];
    for (const site of picked) {
      const r = withMutant(join(base, site.dir, site.file), site.line, () => goTest(join(base, dir), s.tests.map((t) => t.name)));
      if (r.status === "survived") survived.push(site);
      else if (r.status === "killed") killed++;
    }
    return { address: s.address, tests: s.tests.map((t) => `${t.file}:${t.name}`), killed, survived };
  });
  const verdict = new Map<string, { status: string; text: string }>();
  for (const site of results.flatMap((r) => r.survived)) {
    const key = `${posix.join(site.dir, site.file)}:${site.line}`;
    if (!verdict.has(key)) verdict.set(key, withMutant(join(base, site.dir, site.file), site.line, () => goPackage(join(base, site.dir))));
  }
  return results.map((r) => {
    const keys = r.survived.map((site) => `${posix.join(site.dir, site.file)}:${site.line}`);
    const left = keys.filter((k) => verdict.get(k)!.status === "survived");
    return { ...r, killed: r.killed + keys.filter((k) => verdict.get(k)!.status === "killed").length, survived: left.map((k) => `${k} ${verdict.get(k)!.text}`) };
  });
};
