import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Corpus, TestMark } from "./model.js";
import type { Finding } from "./report.js";
import { glob } from "./tests.js";

export const scope = (name: string, platforms: string[]) => {
  const m = name.match(/^([^:]+):\s*(.*)$/);
  const own = m?.[1].split(",").map((p) => p.trim().toLowerCase());
  return m && own!.every((p) => platforms.includes(p)) ? { platforms: own!, name: m[2] } : { platforms, name };
};

export const matrix = (corpora: Corpus[], platforms: Record<string, string[]>, marks: TestMark[], cover: (marks: TestMark[]) => Map<Corpus, Set<string>>) => {
  const names = Object.keys(platforms);
  const all = cover(marks);
  const by = Object.fromEntries(names.map((p) => [p, cover(marks.filter((m) => platforms[p].some((g) => glob(g).test(m.file))))]));
  return corpora.flatMap((corpus) =>
    corpus.requirements.flatMap((r) =>
      r.scenarios.map((s) => {
        const req = `${r.capability.id}/${r.slug}`;
        const key = `${req}#${s.slug}`;
        const has = (covered: Map<Corpus, Set<string>>) => covered.get(corpus)!.has(req) || covered.get(corpus)!.has(key);
        const own = scope(s.name, names).platforms;
        return {
          address: `${corpus.root.space}:${key}`,
          key,
          corpus,
          file: r.capability.file,
          line: s.line,
          tested: has(all),
          platforms: Object.fromEntries(names.map((p) => [p, own.includes(p) ? has(by[p]) : null])) as Record<string, boolean | null>,
        };
      }),
    ),
  );
};

export const untested = (rows: ReturnType<typeof matrix>): Finding[] =>
  rows
    .filter((r) => r.tested)
    .flatMap((r) =>
      Object.entries(r.platforms)
        .filter(([, v]) => v === false)
        .map(([p]) => ({
          level: r.corpus.root.class === "core" ? "error" : "warning",
          rule: "scenario-untested-on-platform",
          file: r.file,
          line: r.line,
          message: `сценарий ${r.key} без теста на платформе ${p}`,
          related: [],
        })),
    );

export const table = (rows: ReturnType<typeof matrix>, names: string[]) =>
  [`| сценарий | ${names.join(" | ")} |`, `|${"---|".repeat(names.length + 1)}`, ...rows.map((r) => `| ${r.address} | ${names.map((p) => ({ true: "✓", false: "✗", null: "—" })[`${r.platforms[p]}`]).join(" | ")} |`)]
    .map((l) => `${l}\n`)
    .join("");

export const view = (base: string, corpora: Corpus[], platform: string, names: string[], module: string | null) =>
  corpora
    .flatMap((c) => c.capabilities.filter((cap) => !module || `${c.root.space}:${cap.id}` === module))
    .map((cap) => {
      const out: string[] = [];
      let req: string[] | null = null;
      let shown = false;
      let keep = true;
      const flush = () => {
        if (req && shown) out.push(...req);
        req = null;
      };
      for (let line of readFileSync(join(base, cap.file), "utf8").split("\n")) {
        if (/^#{1,3}\s/.test(line)) {
          flush();
          keep = true;
          if (/^###\s*Requirement:/i.test(line)) {
            req = [line];
            shown = false;
            continue;
          }
        } else if (/^####\s/.test(line)) {
          const s = scope(line.replace(/^####\s+(Scenario:\s*)?/i, ""), names);
          keep = s.platforms.includes(platform);
          shown ||= keep;
          line = `#### Scenario: ${s.name}`;
        }
        if (keep) (req ?? out).push(line);
      }
      flush();
      return out.join("\n");
    })
    .join("\n");
