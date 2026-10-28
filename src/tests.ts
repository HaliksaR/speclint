import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { Root, TestMark } from "./model.js";
import { TOKEN } from "./openspec.js";
import { literals } from "./literals.js";

const SKIP = new Set(["node_modules", "build", "dist", "out", "target", "Pods", "Carthage", "DerivedData", "venv", "__pycache__"]);

const CONVENTIONS = [
  /(^|\/)src\/[^/]*[tT]est\/.*\.(kt|kts|java)$|(Test|Tests|IT)\.(kt|java)$/,
  /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)__tests__\/.*\.[cm]?[jt]sx?$/,
  /(^|\/)[^/]*Tests\/.*\.swift$/,
  /(^|\/)(test_[^/]*|[^/]*_test)\.py$|(^|\/)tests?\/.*\.py$/,
  /_test\.go$/,
];

const glob = (g: string) =>
  new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/|\*\*|\*|\?/g, (m) => ({ "**/": "(.*/)?", "**": ".*", "*": "[^/]*" })[m] ?? "[^/]")}$`);

const files = (base: string, dir: string): string[] =>
  readdirSync(join(base, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || (e.isDirectory() && SKIP.has(e.name))) return [];
    const path = dir ? `${dir}/${e.name}` : e.name;
    return e.isDirectory() ? files(base, path) : e.isFile() ? [path] : [];
  });

export const loadMarks = (base: string, roots: Root[], tests: string[] | null) => {
  const patterns = tests ? tests.map(glob) : CONVENTIONS;
  const owners = roots.map((root) => ({ root, dir: posix.dirname(posix.normalize(root.path)) }));
  const owner = (file: string) =>
    roots.length === 1
      ? roots[0]
      : owners.filter((o) => o.dir === "." || file.startsWith(`${o.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0]?.root ?? null;
  const testFiles = files(base, "").filter((f) => patterns.some((p) => p.test(f)));
  const strings = new Map<string, Set<string>>();
  const marks: TestMark[] = testFiles.flatMap((file) => {
    const text = readFileSync(join(base, file), "utf8");
    const found = text.split(/\r?\n/).flatMap((line, i) => [...line.matchAll(TOKEN)].map((m) => ({ address: m[1].replace(/[–—]/g, "-"), root: owner(file), file, line: i + 1 })));
    if (found.length) strings.set(file, new Set(literals(text, file).map((l) => l.trim())));
    return found;
  });
  return { marks, files: testFiles.length, literals: strings };
};
