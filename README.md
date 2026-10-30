# speclint

[Русский](README.ru.md)

Deterministic consistency linter for spec-driven repositories. It checks the whole spec corpus at once — not one feature — in a single repository, a monorepo, and across repositories. First supported format: [OpenSpec](https://github.com/Fission-AI/OpenSpec).

No models, no network: the same files give the same report, so it fits CI and coding agents.

## Usage

```bash
npx @haliksar/speclint [path] [--format text|json]
npx @haliksar/speclint manifest [path] --release <version>
npx @haliksar/speclint --version
```

Without `path` the current directory is checked; the root is `<path>/openspec`.

Exit codes: `0` — no errors, `1` — errors found (warnings never fail), `2` — the run is broken (unknown flag or format, no root, unreadable `speclint.json` or manifest, manifest version differs from the pinned one).

Messages are in Russian; rule IDs and the JSON contract are stable:

```json
{
  "tool": "speclint",
  "version": "0.1.0",
  "status": "findings",
  "findings": [
    { "level": "error", "rule": "test-ref-dangling", "file": "src/search.test.ts", "line": 4,
      "message": "spec:serch/find-items#empty: capability нет; похоже на spec:search", "related": [] }
  ],
  "summary": { "errors": 1, "warnings": 0, "infos": 0, "files": 2 }
}
```

## Addresses

A reference in Markdown or a mark in a test is the token `spec:<address>`:

- `spec:auth/session-timeout` — requirement, `spec:auth/session-timeout#idle-timeout` — scenario (slugs of the headings);
- `spec:change/add-2fa` — open change, `spec:decision/0007-jwt` — decision;
- `spec:billing:invoices/issue` — address in another root or repository (namespace `billing`).

## Monorepo

```json
{
  "roots": [
    { "path": "services/auth/openspec", "space": "auth" },
    { "path": "services/billing/openspec", "space": "billing" }
  ],
  "tests": ["**/checks/**"]
}
```

`<path>/speclint.json` lists the roots; only they are checked. An address without a namespace resolves in its own root. `tests` replaces the test file conventions (Kotlin/Java, TypeScript/JS, Swift, Python, Go `*_test.go`).

## Rule levels

```json
{ "rules": { "scenario-steps-missing": "off", "scenario-untested": "error" } }
```

`off` switches a rule off, `error`/`warning`/`info` change its level; the exit code follows the new levels. An unknown rule or level exits `2`.

## Bounded contexts

```json
{
  "roots": [
    { "path": "openspec/orders", "space": "orders", "class": "core", "uses": ["access"] },
    { "path": "openspec/showcase", "space": "showcase", "class": "supporting", "uses": ["orders"] },
    { "path": "openspec/access", "space": "access", "class": "generic", "uses": [] }
  ]
}
```

A root can be a DDD bounded context: `uses` is its context map — a reference to a space outside `uses` is `context-dependency-undeclared`, a cycle is `context-cycle`. In a `core` context an untested scenario is an error. A scenario repeating the steps of another is `scenario-duplicate`.

## Coverage strength

```json
{ "textChecks": ["servedScript(", "os.ReadFile("], "behaviourChecks": ["doRequest(", "httptest."] }
```

A test that only reads source text (a served script, a CSS file) is weaker than one that exercises behaviour. With `textChecks` set, a scenario whose every marked test matches a `textChecks` string and no `behaviourChecks` string is reported as `scenario-tested-by-text` (info). The test body runs from the mark to the next top-level declaration.

## Decisions

`<root>/decisions/<id>.md` with front matter `status: active | superseded | revoked`, `superseded-by: <id>` and a `## Rationale` section. Referencing a superseded decision as if it were current is an error.

## Test coverage

Mark a test with `spec:<address>` anywhere in the test file: name, annotation, string or comment. A requirement mark covers all its scenarios. Each step of a marked scenario (`GIVEN`/`WHEN`/`THEN`/`AND`/`BUT` line) must appear verbatim among string literals of the marked test files: `- **WHEN** the user enters a valid password` → `step("WHEN the user enters a valid password")`.

A root without a single mark gets one summary info instead of a warning per scenario. A `spec:` string whose capability is unknown everywhere is foreign data (`"spec:alpha"`), unless it is one or two letters off a known capability — then it is a typo error.

## Multirepo

The provider prints a manifest on release and publishes it any way it likes:

```bash
npx @haliksar/speclint manifest . --release 1.4.0 > identity.manifest.json
```

The consumer commits a copy and pins the version:

```json
{
  "roots": [{ "path": "openspec", "space": "web" }],
  "dependencies": {
    "identity": { "manifest": "speclint/identity.manifest.json", "version": "1.4.0" },
    "legacy": { "unchecked": true }
  }
}
```

References and marks `spec:identity:…` are checked offline against the copy with the same rules as local ones. A provider that declares its consumers' manifests in `dependencies` sees coverage by their tests.

## Rules

| ID | Level | What |
|---|---|---|
| `ref-dangling` | error | address does not resolve: no capability, requirement, scenario, change, decision |
| `ref-archived` | error | reference to an archived change or a requirement removed by one |
| `address-collision` | error | two requirements or two scenarios give one slug |
| `delta-target-missing` | error | MODIFIED, REMOVED or RENAMED of a requirement that does not exist |
| `delta-target-exists` | error | ADDED of a requirement that already exists |
| `delta-overlap` | warning | two open changes touch one requirement |
| `ref-external-unchecked` | info | namespace declared `unchecked` |
| `decision-inactive-ref` | error | reference to a superseded or revoked decision |
| `decision-no-rationale` | warning | decision without rationale |
| `decision-status-invalid` | error | bad status or `superseded-by` |
| `decision-supersede-missing` | error | `superseded-by` points to a missing decision |
| `decision-supersede-cycle` | error | supersede chain loops |
| `test-ref-dangling` | error | test mark to a missing address |
| `scenario-untested` | warning | scenario has no test mark |
| `dependency-missing` | error | namespace not in `dependencies`, or manifest missing |
| `scenario-untested-anywhere` | warning | scenario not covered in any known repository |
| `scenario-steps-missing` | warning | scenario step not found verbatim in marked tests |
| `context-dependency-undeclared` | error | reference to a context outside `uses` |
| `context-cycle` | error | cycle in `uses` |
| `scenario-duplicate` | warning | scenario repeats the steps of another |
| `scenario-tested-by-text` | info | scenario is held only by tests that read source text |

Design, contracts and decisions (in Russian): [PLAN.md](PLAN.md), [docs/architecture.md](docs/architecture.md), [docs/requirements.md](docs/requirements.md).

## License

MIT
