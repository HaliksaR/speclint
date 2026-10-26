import { slug, steps, type Change, type Corpus, type Delta, type TestMark } from "./model.js";

const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const sortBy = <T>(items: T[], key: (item: T) => string) => [...items].sort((a, b) => byCode(key(a), key(b)));
const capOf = (address: string) => address.slice(0, address.lastIndexOf("/"));
const lastOf = (address: string) => address.slice(address.lastIndexOf("/") + 1);

export const toManifest = (corpora: Corpus[], covered: Map<Corpus, Set<string>>, marks: TestMark[], release: string) => {
  const spaces = new Set(corpora.map((c) => c.root.space));
  const roots = sortBy(corpora, (c) => c.root.space!).map((corpus) => {
    const done = covered.get(corpus)!;
    const archived = corpus.changes.filter((c) => c.archived).flatMap((c) => c.deltas);
    const history = archived
      .filter((d) => d.op === "removed" || d.op === "renamed")
      .map((d) => ({
        address: `${d.capability}/${slug(d.requirement)}`,
        status: d.op,
        change: d.change.id,
        ...(d.op === "renamed" ? { to: `${d.capability}/${slug(d.to!)}` } : {}),
      }));
    const active = corpus.requirements.map((r) => {
      const address = `${r.capability.id}/${r.slug}`;
      const scenarios = r.scenarios.map((s) => ({
        address: `${address}#${s.slug}`,
        name: s.name,
        steps: steps(s),
        covered: done.has(address) || done.has(`${address}#${s.slug}`),
      }));
      return { address, status: "active", name: r.name, scenarios: sortBy(scenarios, (s) => s.address) };
    });
    return {
      space: corpus.root.space,
      capabilities: corpus.capabilities.map((c) => c.id).sort(byCode),
      requirements: sortBy([...history, ...active], (r) => `${r.address}\0${r.status}`),
      changes: sortBy(corpus.changes, (c) => c.id).map((c) => ({ id: c.id, archived: c.archived })),
      decisions: sortBy(corpus.decisions, (d) => d.id).map((d) => ({
        address: `decision/${d.id}`,
        status: d.status,
        supersededBy: d.supersededBy ? `decision/${d.supersededBy}` : null,
      })),
    };
  });
  const external = marks.map((m) => m.address).filter((a) => {
    const space = a.match(/^([a-z0-9-]+):/)?.[1];
    return space !== undefined && !spaces.has(space);
  });
  return JSON.stringify({ speclint: 2, version: release, roots, marks: [...new Set(external)].sort(byCode) }, null, 2);
};

export const fromManifest = (manifest: any, space: string, file: string) => {
  const r = manifest.roots.find((x: any) => x.space === space);
  if (!r) return null;
  const root = { path: file, space };
  const capabilities = r.capabilities.map((id: string) => ({ root, id, file }));
  const changes: Change[] = r.changes.map((c: any) => ({ root, id: c.id, archived: c.archived, deltas: [] }));
  for (const q of r.requirements.filter((q: any) => q.status !== "active")) {
    const change = changes.find((c) => c.id === q.change)!;
    const delta: Delta = { change, capability: capOf(q.address), op: q.status, requirement: lastOf(q.address), to: q.to ? lastOf(q.to) : null, file, line: 0, scenarios: [] };
    change.deltas.push(delta);
  }
  const active = r.requirements.filter((q: any) => q.status === "active");
  const corpus: Corpus = {
    root,
    capabilities,
    requirements: active.map((q: any) => ({
      capability: capabilities.find((c: any) => c.id === capOf(q.address)),
      name: q.name,
      slug: lastOf(q.address),
      line: 0,
      scenarios: q.scenarios.map((s: any) => ({ name: s.name, slug: s.address.split("#")[1], line: 0, steps: s.steps ?? [] })),
    })),
    changes,
    references: [],
    decisions: r.decisions.map((d: any) => ({
      id: d.address.slice("decision/".length),
      status: d.status,
      supersededBy: d.supersededBy?.slice("decision/".length) ?? null,
      rationale: true,
      file,
    })),
    files: 0,
  };
  const covered = new Set<string>(active.flatMap((q: any) => q.scenarios.filter((s: any) => s.covered).map((s: any) => s.address)));
  return { corpus, covered, marks: manifest.marks as string[] };
};
