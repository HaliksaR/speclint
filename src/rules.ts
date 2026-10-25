import { slug, type Change, type Corpus, type Decision, type Delta, type Reference, type Scenario } from "./model.js";
import type { Finding } from "./report.js";

type Item = { name: string; slug: string; file: string; line: number; scenarios: Scenario[] };
type Capability = { file: string; reqs: Map<string, Item> };
type View = Map<string, Capability>;
type Place = { file: string; line: number | null };
type Resolved = { ok: true; at: Place } | { ok: false; message: string; missing: { cap: string; slug: string } | null };

const ORDER: Delta["op"][] = ["renamed", "removed", "modified", "added"];

const mainView = (corpus: Corpus): View => {
  const view: View = new Map(corpus.capabilities.map((c) => [c.id, { file: c.file, reqs: new Map() }]));
  for (const r of corpus.requirements)
    view.get(r.capability.id)!.reqs.set(r.name, { name: r.name, slug: r.slug, file: r.capability.file, line: r.line, scenarios: r.scenarios });
  return view;
};

const apply = (base: View, change: Change, check: (d: Delta, reqs: Map<string, Item>) => void = () => {}): View => {
  const view: View = new Map([...base].map(([id, c]) => [id, { file: c.file, reqs: new Map(c.reqs) }]));
  for (const d of ORDER.flatMap((op) => change.deltas.filter((d) => d.op === op))) {
    if (!view.has(d.capability)) view.set(d.capability, { file: d.file, reqs: new Map() });
    const reqs = view.get(d.capability)!.reqs;
    check(d, reqs);
    const old = reqs.get(d.requirement);
    if (d.op === "renamed" && old) {
      reqs.delete(d.requirement);
      reqs.set(d.to!, { ...old, name: d.to!, slug: slug(d.to!) });
    } else if (d.op === "removed") reqs.delete(d.requirement);
    else if (d.op !== "renamed")
      reqs.set(d.requirement, { name: d.requirement, slug: slug(d.requirement), file: d.file, line: d.line, scenarios: d.scenarios });
  }
  return view;
};

const resolve = (view: View, target: string): Resolved => {
  const [path, scenario] = target.split("#");
  const segs = path.split("/");
  let n = segs.length;
  while (n > 0 && !view.has(segs.slice(0, n).join("/"))) n--;
  if (n === 0) return { ok: false, message: "capability нет", missing: null };
  const cap = segs.slice(0, n).join("/");
  const capability = view.get(cap)!;
  const rest = segs.slice(n);
  if (rest.length === 0 && scenario === undefined) return { ok: true, at: { file: capability.file, line: null } };
  const item = rest.length === 1 ? [...capability.reqs.values()].find((r) => r.slug === rest[0]) : undefined;
  if (!item) return { ok: false, message: `требования нет в ${cap}`, missing: rest.length === 1 ? { cap, slug: rest[0] } : null };
  if (scenario === undefined) return { ok: true, at: item };
  const s = item.scenarios.find((s) => s.slug === scenario);
  return s ? { ok: true, at: { file: item.file, line: s.line } } : { ok: false, message: `сценария нет в ${cap}/${item.slug}`, missing: null };
};

type Context = { corpus: Corpus; open: Change[]; archived: Change[]; main: View; views: Map<Change, View> };

export const check = (corpora: Corpus[]): Finding[] => {
  const findings: Finding[] = [];
  const add = (level: Finding["level"], rule: string, at: Place, message: string, related: Place[] = []) =>
    findings.push({ level, rule, file: at.file, line: at.line, message, related: related.map((p) => ({ file: p.file, line: p.line })) });
  const label = (d: Delta) => `${d.capability}/${d.requirement}`;

  const contexts = corpora.map((corpus): Context => {
    const open = corpus.changes.filter((c) => !c.archived);
    const archived = corpus.changes.filter((c) => c.archived);
    const main = mainView(corpus);

    const views = new Map(
      open.map((change) => [
        change,
        apply(main, change, (d, reqs) => {
          if (d.op === "added" && reqs.has(d.requirement)) add("error", "delta-target-exists", d, `ADDED ${label(d)}: требование уже есть`);
          const addedElsewhere = open.some(
            (c) => c !== change && c.deltas.some((e) => e.op === "added" && e.capability === d.capability && e.requirement === d.requirement),
          );
          if (d.op !== "added" && !reqs.has(d.requirement) && !addedElsewhere)
            add("error", "delta-target-missing", d, `${d.op.toUpperCase()} ${label(d)}: требования нет`);
        }),
      ]),
    );

    const deltas = open.flatMap((c) => c.deltas);
    for (const d of deltas) {
      const others = deltas.filter((e) => e.change !== d.change && e.capability === d.capability && e.requirement === d.requirement);
      if (others.length)
        add("warning", "delta-overlap", d, `требование ${label(d)} трогает и изменение ${[...new Set(others.map((e) => e.change.id))].join(", ")}`, others);
    }

    const seen = new Set<string>();
    const collide = (key: string, at: Place, message: string, first: Place) => {
      if (seen.has(key)) return;
      seen.add(key);
      add("error", "address-collision", at, message, [first]);
    };
    for (const view of [main, ...views.values()])
      for (const [cap, { reqs }] of view) {
        const items = [...reqs.values()];
        items.forEach((r) => {
          const first = items.find((o) => o.slug === r.slug)!;
          if (first !== r) collide(`${cap}/${r.slug}|${first.name}|${r.name}`, r, `адрес ${cap}/${r.slug} у двух требований: ${first.name}, ${r.name}`, first);
          for (const s of r.scenarios) {
            const fs = r.scenarios.find((o) => o.slug === s.slug)!;
            if (fs !== s)
              collide(`${cap}/${r.slug}#${s.slug}|${fs.name}|${s.name}`, { file: r.file, line: s.line },
                `адрес ${cap}/${r.slug}#${s.slug} у двух сценариев: ${fs.name}, ${s.name}`, { file: r.file, line: fs.line });
          }
        });
      }

    const decision = (id: string) => corpus.decisions.find((d) => d.id === id);
    for (const d of corpus.decisions) {
      const at = { file: d.file, line: 1 };
      if (!["active", "superseded", "revoked"].includes(d.status))
        add("error", "decision-status-invalid", at, `решение ${d.id}: статус ${d.status || "не указан"}, ожидается active | superseded | revoked`);
      else if (d.status === "superseded" && !d.supersededBy) add("error", "decision-status-invalid", at, `решение ${d.id}: superseded без superseded-by`);
      else if (d.status !== "superseded" && d.supersededBy) add("error", "decision-status-invalid", at, `решение ${d.id}: superseded-by при статусе ${d.status}`);
      if (!d.rationale) add("warning", "decision-no-rationale", at, `решение ${d.id} без обоснования`);
      if (d.supersededBy && !decision(d.supersededBy)) add("error", "decision-supersede-missing", at, `решение ${d.id} заменено несуществующим ${d.supersededBy}`);
      const chain = replacements(corpus, d);
      if (chain.at(-1) === d) add("error", "decision-supersede-cycle", at, `цикл замен: ${[d, ...chain].map((c) => c.id).join(" → ")}`);
    }

    return { corpus, open, archived, main, views };
  });

  function replacements(corpus: Corpus, from: Decision) {
    const chain: Decision[] = [];
    for (let d = from, next; d.supersededBy && (next = corpus.decisions.find((e) => e.id === d.supersededBy)) && !chain.includes(next); d = next) chain.push(next);
    return chain;
  }

  for (const own of contexts) for (const ref of own.corpus.references) checkReference(own, ref);

  function checkReference(own: Context, ref: Reference) {
    const token = `spec:${ref.address}`;
    const external = ref.address.match(/^([a-z0-9-]+):(.*)$/);
    const ctx = external ? contexts.find((c) => c.corpus.root.space === external[1]) : own;
    if (!ctx) return add("info", "ref-external-unchecked", ref, `${token}: внешний адрес не проверяется до M5`);
    const { open, archived, views } = ctx;
    const local = ctx === own ? ref.change : null;
    const target = external ? external[2] : ref.address;
    if (target.startsWith("change/")) {
      const id = target.slice("change/".length);
      if (open.some((c) => c.id === id)) return;
      if (archived.some((c) => c.id === id)) return add("error", "ref-archived", ref, `${token}: изменение в архиве`);
      return add("error", "ref-dangling", ref, `${token}: изменения нет`);
    }
    if (target.startsWith("decision/")) {
      const d = ctx.corpus.decisions.find((d) => d.id === target.slice("decision/".length));
      if (!d) return add("error", "ref-dangling", ref, `${token}: решения нет`);
      if (d.status === "active" || own.corpus.decisions.some((o) => o.file === ref.file)) return;
      if (d.status === "revoked") return add("error", "decision-inactive-ref", ref, `${token}: решение отменено`);
      const chain = replacements(ctx.corpus, d);
      const next = (chain.at(-1) ?? d).supersededBy;
      const tail = next && !ctx.corpus.decisions.some((e) => e.id === next) ? [next] : [];
      return add("error", "decision-inactive-ref", ref, `${token}: решение заменено: ${[d.id, ...chain.map((c) => c.id), ...tail].join(" → ")}`, chain.map((c) => ({ file: c.file, line: 1 })));
    }
    const result = resolve(local ? views.get(local)! : ctx.main, target);
    if (result.ok) return;
    if (result.missing) {
      const { cap, slug: wanted } = result.missing;
      const renames = [...archived, ...(local ? [local] : [])].flatMap((c) => c.deltas).filter((d) => d.op === "renamed" && d.capability === cap);
      const chain: Delta[] = [];
      let current = wanted;
      for (let d; (d = renames.find((r) => slug(r.requirement) === current)) && !chain.includes(d); current = slug(d.to!)) chain.push(d);
      if (chain.length)
        return add("error", "ref-dangling", ref, `${token}: требование переименовано в spec:${external ? `${external[1]}:` : ""}${cap}/${current} (${chain.map((d) => d.change.id).join(", ")})`, chain);
      const removed = archived.flatMap((c) => c.deltas).find((d) => d.op === "removed" && d.capability === cap && slug(d.requirement) === wanted);
      if (removed) return add("error", "ref-archived", ref, `${token}: требование удалено архивным изменением ${removed.change.id}`, [removed]);
    }
    const elsewhere = open.filter((c) => c !== local).flatMap((c) => {
      const r = resolve(views.get(c)!, target);
      return r.ok ? [{ id: c.id, at: r.at }] : [];
    });
    if (elsewhere.length)
      return add("error", "ref-dangling", ref, `${token}: ${result.message}; есть в открытом изменении ${elsewhere.map((e) => e.id).join(", ")}`, elsewhere.map((e) => e.at));
    add("error", "ref-dangling", ref, `${token}: ${result.message}`);
  }

  const key = (f: Finding) => [f.file ?? "", String(f.line ?? 0).padStart(9, "0"), f.rule];
  return findings.sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return 0;
  });
};
