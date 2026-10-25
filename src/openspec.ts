import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { slug, type Capability, type Change, type Corpus, type Delta, type Reference, type Requirement, type Root, type Scenario } from "./model.js";

type Line = { text: string; line: number; code: boolean };
type Block = { name: string; line: number; body: Line[] };

const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const entries = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith("."))
        .sort((a, b) => byCodePoint(a.name, b.name))
    : [];

const walk = (dir: string): string[] =>
  entries(dir).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

const toLines = (text: string): Line[] => {
  let fence = false;
  return text.split(/\r?\n/).map((t, i) => {
    const marker = /^\s*(```|~~~)/.test(t);
    const code = fence || marker;
    if (marker) fence = !fence;
    return { text: t, line: i + 1, code };
  });
};

const sections = (lines: Line[]) => {
  const result: { title: string; lines: Line[] }[] = [];
  for (const l of lines) {
    const m = l.code ? null : l.text.match(/^##\s+(.+?)\s*$/);
    if (m) result.push({ title: m[1], lines: [] });
    else result.at(-1)?.lines.push(l);
  }
  return result;
};

const cleanName = (name: string) => name.replace(/\s*#+\s*$/, "").trim();

const REQUIREMENT = /^###\s*Requirement:\s*(.+)\s*$/i;

const blocks = (lines: Line[]) => {
  const result: Block[] = [];
  for (const l of lines) {
    const m = l.code ? null : l.text.match(REQUIREMENT);
    if (m) result.push({ name: cleanName(m[1]), line: l.line, body: [] });
    else result.at(-1)?.body.push(l);
  }
  return result;
};

const scenarios = (body: Line[]) => {
  const result: Scenario[] = [];
  let current: Scenario | null = null;
  for (const l of body) {
    const header = !l.code && /^#{1,4}\s/.test(l.text);
    if (header) {
      if (current?.steps.length) result.push(current);
      const m = l.text.match(/^####\s+(.*)$/);
      const name = m ? cleanName(m[1].replace(/^Scenario:\s*/i, "")) : null;
      current = name ? { name, slug: slug(name), line: l.line, steps: [] } : null;
    } else if (current && l.text.trim()) current.steps.push(l.text.trim());
  }
  if (current?.steps.length) result.push(current);
  return result;
};

const requirements = (capability: Capability, text: string): Requirement[] =>
  sections(toLines(text))
    .filter((s) => /^Requirements$/i.test(s.title))
    .flatMap((s) => blocks(s.lines))
    .map((b) => ({ capability, name: b.name, slug: slug(b.name), line: b.line, scenarios: scenarios(b.body) }));

const deltas = (change: Change, capability: string, file: string, text: string): Delta[] => {
  const delta = (op: Delta["op"], requirement: string, to: string | null, line: number, scenarios: Scenario[]): Delta =>
    ({ change, capability, op, requirement, to, file, line, scenarios });
  return sections(toLines(text)).flatMap((s) => {
    const op = s.title.match(/^(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements$/i)?.[1].toLowerCase() as Delta["op"] | undefined;
    if (op === "added" || op === "modified") return blocks(s.lines).map((b) => delta(op, b.name, null, b.line, scenarios(b.body)));
    const plain = s.lines.filter((l) => !l.code);
    if (op === "removed")
      return plain.flatMap((l) => {
        const m = l.text.match(REQUIREMENT) ?? l.text.match(/^\s*[-*+]\s*`?###\s*Requirement:\s*(.+?)`?\s*$/);
        return m ? [delta(op, cleanName(m[1]), null, l.line, [])] : [];
      });
    if (op === "renamed") {
      const result: Delta[] = [];
      let from: Line & { name: string } | null = null;
      for (const l of plain) {
        const f = l.text.match(/^\s*[-*+]?\s*FROM:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/);
        const t = l.text.match(/^\s*[-*+]?\s*TO:\s*`?###\s*Requirement:\s*(.+?)`?\s*$/);
        if (f) from = { ...l, name: cleanName(f[1]) };
        else if (t && from) {
          result.push(delta(op, from.name, cleanName(t[1]), from.line, []));
          from = null;
        }
      }
      return result;
    }
    return [];
  });
};

const TOKEN = /(?<![\p{L}\p{N}_-])spec:([\p{L}\p{N}_\-/#:]+)/gu;

export const loadOpenSpec = (base: string): Corpus | null => {
  const rootDir = join(base, "openspec");
  if (!existsSync(rootDir)) return null;
  const root: Root = { path: "openspec", space: null };
  const rel = (abs: string) => relative(base, abs).split(sep).join("/");
  const read = new Set<string>();
  const text = (abs: string) => {
    read.add(abs);
    return readFileSync(abs, "utf8");
  };
  const specFiles = (dir: string) => walk(dir).filter((f) => f.endsWith(`${sep}spec.md`) && dirname(f) !== dir);
  const capId = (dir: string, f: string) => relative(dir, dirname(f)).split(sep).join("/");

  const specsDir = join(rootDir, "specs");
  const capabilities = specFiles(specsDir).map((f) => ({ root, id: capId(specsDir, f), file: rel(f) }));
  const reqs = capabilities.flatMap((c) => requirements(c, text(join(base, c.file))));

  const changesDir = join(rootDir, "changes");
  const archiveDir = join(changesDir, "archive");
  const folders = [
    ...entries(changesDir).filter((e) => e.isDirectory() && e.name !== "archive").map((e) => ({ dir: join(changesDir, e.name), id: e.name, archived: false })),
    ...entries(archiveDir).filter((e) => e.isDirectory()).map((e) => ({ dir: join(archiveDir, e.name), id: e.name.replace(/^\d{4}-\d{2}-\d{2}-/, ""), archived: true })),
  ];
  const changes = folders.map(({ dir, id, archived }) => {
    const change: Change = { root, id, archived, deltas: [] };
    const deltaDir = join(dir, "specs");
    change.deltas = specFiles(deltaDir).flatMap((f) => deltas(change, capId(deltaDir, f), rel(f), text(f)));
    return { change, dir };
  });

  const references: Reference[] = walk(rootDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith(archiveDir + sep))
    .flatMap((f) => {
      const change = changes.find((c) => !c.change.archived && f.startsWith(c.dir + sep))?.change ?? null;
      return toLines(text(f)).flatMap((l) => [...l.text.matchAll(TOKEN)].map((m) => ({ address: m[1], file: rel(f), line: l.line, change })));
    });

  return { root, capabilities, requirements: reqs, changes: changes.map((c) => c.change), references, files: read.size };
};
