import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { slug, type Corpus, type Root, type TestMark } from "./model.js";
import { covered, testName } from "./mutate.js";

type Reason = { file: string; from: number; to: number; via: string };
type Hit = { root: Root; capability: string; reasons: Reason[] };

const changedLines = (base: string, range: string | null) => {
  const r = spawnSync("git", ["diff", "-U0", "--no-color", "--no-renames", "--relative", range ?? "HEAD"], { cwd: base, encoding: "utf8" });
  if (r.status !== 0) return null;
  const changed: { file: string; line: number }[] = [];
  let file: string | null = null;
  for (const row of r.stdout.split("\n")) {
    if (row.startsWith("+++ ")) file = row === "+++ /dev/null" ? null : row.slice(6);
    const m = file ? row.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/) : null;
    if (!m) continue;
    const from = Number(m[1]);
    const count = Math.max(m[2] === undefined ? 1 : Number(m[2]), 1);
    for (let l = from; l < from + count; l++) changed.push({ file: file!, line: Math.max(l, 1) });
  }
  return changed;
};

const headings = (text: string) => {
  let req: string | null = null;
  let scn: string | null = null;
  return text.split(/\r?\n/).map((t) => {
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h && h[1].length < 4) {
      const r = h[2].match(/^Requirement:\s*(.+)/i);
      req = h[1].length === 3 && r ? slug(r[1]) : null;
      scn = null;
    } else if (h) scn = req && slug(h[2].replace(/^Scenario:\s*/i, ""));
    return { req, scn };
  });
};

export const impact = (base: string, corpora: Corpus[], marks: TestMark[], range: string | null, rebuild: boolean) => {
  const changed = changedLines(base, range);
  if (!changed) return null;
  const prefix = (root: Root) => (corpora.length > 1 && root.space ? `${root.space}:` : "");
  const scenarios = corpora.flatMap((c) =>
    c.requirements.flatMap((r) =>
      r.scenarios.map((s) => {
        const req = `${prefix(c.root)}${r.capability.id}/${r.slug}`;
        return { address: `${req}#${s.slug}`, keys: [req, `${req}#${s.slug}`], root: c.root, capability: `${prefix(c.root)}${r.capability.id}` };
      }),
    ),
  );
  const hits = new Map<string, Hit>();
  const hit = (address: string, root: Root, capability: string, file: string, line: number, via = "") => {
    const h = hits.get(address) ?? { root, capability, reasons: [] };
    const same = h.reasons.filter((r) => r.file === file && r.via === via);
    const next = same.find((r) => r.to === line - 1);
    if (next) next.to = line;
    else if (!same.some((r) => r.from <= line && line <= r.to)) h.reasons.push({ file, from: line, to: line, via });
    hits.set(address, h);
  };
  const hitMark = (address: string, file: string, line: number, via = "") => {
    for (const s of scenarios) if (s.keys.includes(address)) hit(s.address, s.root, s.capability, file, line, via);
  };
  const specRoots = new Set<Root>();
  const texts = new Map<string, ReturnType<typeof headings>>();
  for (const { file, line } of changed.filter((c) => /(^|\/)spec\.md$/.test(c.file))) {
    const root = corpora.map((c) => c.root).find((r) => file.startsWith(`${posix.normalize(r.path)}/`));
    if (!root || !existsSync(join(base, file))) continue;
    specRoots.add(root);
    const state = texts.get(file) ?? headings(readFileSync(join(base, file), "utf8"));
    texts.set(file, state);
    const at = state[line - 1];
    if (!at?.req) continue;
    const capability = `${prefix(root)}${posix.basename(posix.dirname(file))}`;
    const names = at.scn ? [at.scn] : [...new Set(state.filter((s) => s.req === at.req && s.scn).map((s) => s.scn!))];
    for (const scn of names) hit(`${capability}/${at.req}#${scn}`, root, capability, file, line);
  }
  for (const { file, line } of changed)
    for (const mark of marks) if (mark.file === file && mark.line <= line && line <= mark.end) hitMark(mark.address, file, line);
  const code = changed.filter((c) => c.file.endsWith(".go") && !c.file.endsWith("_test.go"));
  if (code.length) {
    const tests = new Map<string, { file: string; name: string; addresses: Set<string> }>();
    const sources = new Map<string, string[]>();
    for (const mark of marks.filter((m) => m.file.endsWith("_test.go"))) {
      const lines = sources.get(mark.file) ?? readFileSync(join(base, mark.file), "utf8").split("\n");
      sources.set(mark.file, lines);
      const name = testName(lines, mark.line);
      if (!name) continue;
      const key = `${mark.file}:${name}`;
      const t = tests.get(key) ?? { file: mark.file, name, addresses: new Set<string>() };
      t.addresses.add(mark.address);
      tests.set(key, t);
    }
    const cache = join(base, ".speclint", "coverage.json");
    const map: Record<string, string[]> = !rebuild && existsSync(cache) ? JSON.parse(readFileSync(cache, "utf8")) : {};
    for (const [key, t] of tests) map[key] ??= [...(covered(base, posix.dirname(t.file), [t.name], true) ?? [])];
    mkdirSync(join(base, ".speclint"), { recursive: true });
    writeFileSync(cache, JSON.stringify(map));
    for (const [key, t] of tests) {
      const lines = new Set(map[key]);
      for (const { file, line } of code)
        if (lines.has(`${file}:${line}`)) for (const address of t.addresses) hitMark(address, file, line, key);
    }
  }
  const sorted = [...hits].sort(([a], [b]) => a.localeCompare(b));
  const roots = [...new Set([...specRoots, ...sorted.map(([, h]) => h.root)])].sort((a, b) => (a.space ?? "").localeCompare(b.space ?? ""));
  const findings: { level: string; rule: string; message: string }[] = [];
  if (roots.length > 1) findings.push({ level: "warning", rule: "impact-crosses-contexts", message: `изменение задевает контексты ${roots.map((r) => r.space).join(", ")}` });
  for (const spec of specRoots)
    for (const r of roots)
      if (spec.uses && r !== spec && !spec.uses.includes(r.space!))
        findings.push({
          level: "warning",
          rule: "impact-context-undeclared",
          message: `изменение задевает контекст ${r.space}, которого нет в uses контекста ${spec.space}, чьи спеки оно меняет`,
        });
  return {
    contexts: roots.map((r) => ({ space: r.space, class: r.class ?? null, scenarios: sorted.filter(([, h]) => h.root === r).length })),
    modules: [...new Set(sorted.map(([, h]) => h.capability))].sort(),
    scenarios: sorted.map(([address, h]) => ({
      address,
      reasons: h.reasons.map((r) => `${r.file}:${r.from}${r.to > r.from ? `-${r.to}` : ""}${r.via ? ` (${r.via})` : ""}`),
    })),
    findings,
  };
};
