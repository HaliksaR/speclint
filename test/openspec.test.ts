import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const run = (name: string, ...args: string[]) =>
  spawnSync("node", [new URL("../dist/cli.js", import.meta.url).pathname, fixture(name), ...args], {
    encoding: "utf8",
  });
const report = (name: string) => {
  const r = run(name, "--format", "json");
  return { ...JSON.parse(r.stdout), code: r.status };
};
const uncovered = (name: string) => {
  const r = report(name);
  return { ...r, findings: r.findings.filter((f: { rule: string }) => f.rule !== "scenario-untested") };
};
const at = (level: string, rule: string, file: string, line: number, message: string, related: [string, number][] = []) => ({
  level,
  rule,
  file,
  line,
  message,
  related: related.map(([file, line]) => ({ file, line })),
});

describe("a consistent OpenSpec repository", () => {
  it("has no findings and exits 0", () => {
    const r = report("clean");
    expect(r.findings).toEqual([]);
    expect(r.status).toBe("ok");
    expect(r.summary).toEqual({ errors: 0, warnings: 0, infos: 0, files: 7 });
    expect(r.code).toBe(0);
  });

  it("prints a one-line summary in text format", () => {
    const r = run("clean");
    expect(r.stdout.trim()).toBe("speclint: ошибок 0, предупреждений 0, файлов 7");
    expect(r.status).toBe(0);
  });
});

describe("references", () => {
  const readme = "openspec/README.md";
  const findings = () => uncovered("refs").findings;

  it("reports addresses that do not resolve", () => {
    expect(findings()).toEqual(
      expect.arrayContaining([
        at("error", "ref-dangling", readme, 3, "spec:auth/session-timout: требования нет в auth"),
        at("error", "ref-dangling", readme, 4, "spec:payments: capability нет"),
        at("error", "ref-dangling", readme, 5, "spec:auth/session-timeout#missing: сценария нет в auth/session-timeout"),
        at("error", "ref-dangling", readme, 6, "spec:change/ghost: изменения нет"),
        at("error", "ref-dangling", readme, 12, "spec:auth/session-timeout/extra: требования нет в auth"),
      ]),
    );
  });

  it("reports references into the archive", () => {
    expect(findings()).toEqual(
      expect.arrayContaining([
        at("error", "ref-archived", readme, 7, "spec:change/drop-legacy: изменение в архиве"),
        at("error", "ref-archived", readme, 8, "spec:auth/legacy-login: требование удалено архивным изменением drop-legacy", [
          ["openspec/changes/archive/2026-03-01-drop-legacy/specs/auth/spec.md", 2],
        ]),
      ]),
    );
  });

  it("names the new address of a renamed requirement through the whole chain", () => {
    expect(findings()).toContainEqual(
      at("error", "ref-dangling", readme, 9, "spec:auth/login: требование переименовано в spec:auth/log-in (rename-login, rename-signin)", [
        ["openspec/changes/archive/2026-01-10-rename-login/specs/auth/spec.md", 2],
        ["openspec/changes/archive/2026-02-01-rename-signin/specs/auth/spec.md", 2],
      ]),
    );
  });

  it("does not see another open change's requirements from outside it", () => {
    expect(findings()).toContainEqual(
      at("error", "ref-dangling", readme, 10, "spec:auth/two-factor: требования нет в auth; есть в открытом изменении add-2fa", [
        ["openspec/changes/add-2fa/specs/auth/spec.md", 3],
      ]),
    );
  });

  it("sees the change's own deltas from inside the change folder", () => {
    expect(findings()).toContainEqual(
      at(
        "error",
        "ref-dangling",
        "openspec/changes/rename-timeout/proposal.md",
        3,
        "spec:auth/session-timeout: требование переименовано в spec:auth/idle-timeout (rename-timeout)",
        [["openspec/changes/rename-timeout/specs/auth/spec.md", 2]],
      ),
    );
  });

  it("reports a space that is not declared in dependencies", () => {
    expect(findings()).toContainEqual(
      at("error", "dependency-missing", readme, 11, "spec:billing:invoices/create: пространство billing не объявлено в dependencies"),
    );
  });

  it("prints findings as file:line lines in text format", () => {
    expect(run("refs").stdout).toContain(`${readme}:3: error ref-dangling: spec:auth/session-timout: требования нет в auth\n`);
  });

  it("reports nothing else and exits 1", () => {
    const r = uncovered("refs");
    expect(r.findings).toHaveLength(11);
    expect(r.summary).toEqual({ errors: 11, warnings: 2, infos: 0, files: 9 });
    expect(r.status).toBe("findings");
    expect(r.code).toBe(1);
  });
});

describe("deltas and addresses", () => {
  const auth = "openspec/specs/auth/spec.md";
  const delta = (change: string, cap = "auth") => `openspec/changes/${change}/specs/${cap}/spec.md`;

  it("reports the whole corpus in file and line order", () => {
    expect(uncovered("deltas").findings).toEqual([
      at("warning", "delta-overlap", delta("add-2fa"), 3, "требование auth/Two Factor трогает и изменение tune-2fa", [[delta("tune-2fa"), 3]]),
      at("warning", "delta-overlap", delta("add-2fa"), 9, "требование auth/Sign In трогает и изменение shorten-timeout", [[delta("shorten-timeout"), 2]]),
      at("error", "delta-target-exists", delta("add-2fa"), 9, "ADDED auth/Sign In: требование уже есть"),
      at("error", "address-collision", delta("new-capability", "audit"), 9, "адрес audit/audit-log у двух требований: Audit Log, Audit-Log", [[delta("new-capability", "audit"), 3]]),
      at("warning", "delta-overlap", delta("shorten-timeout"), 2, "требование auth/Sign In трогает и изменение add-2fa", [[delta("add-2fa"), 9]]),
      at("warning", "delta-overlap", delta("tune-2fa"), 3, "требование auth/Two Factor трогает и изменение add-2fa", [[delta("add-2fa"), 3]]),
      at("error", "delta-target-missing", delta("tune-2fa"), 10, "REMOVED auth/Remember Me: требования нет"),
      at("error", "delta-target-missing", delta("tune-2fa"), 13, "RENAMED auth/Ghost: требования нет"),
      at("error", "address-collision", auth, 14, "адрес auth/session-timeout#idle-timeout у двух сценариев: Idle timeout, Idle Timeout!", [[auth, 11]]),
      at("error", "address-collision", auth, 17, "адрес auth/session-timeout у двух требований: Session Timeout, Session-Timeout", [[auth, 8]]),
    ]);
  });
});

describe("a monorepo with several roots in speclint.json", () => {
  const auth = "services/auth/openspec";
  const billing = "services/billing/openspec";

  it("checks only configured roots, resolves addresses across them by space and keeps deltas per root", () => {
    const r = uncovered("monorepo");
    expect(r.findings).toEqual([
      at("error", "ref-dangling", `${auth}/README.md`, 5, "spec:invoices/create: capability нет"),
      at("error", "ref-dangling", `${billing}/README.md`, 5, "spec:auth:session/logout: требования нет в session"),
      at("error", "ref-dangling", `${billing}/README.md`, 6, "spec:auth:session/login: требование переименовано в spec:auth:session/sign-in (rename-login)", [
        [`${auth}/changes/archive/2026-02-01-rename-login/specs/session/spec.md`, 2],
      ]),
      at("error", "ref-dangling", `${billing}/README.md`, 7, "spec:auth:session/two-factor: требования нет в session; есть в открытом изменении add-2fa", [
        [`${auth}/changes/add-2fa/specs/session/spec.md`, 3],
      ]),
      at("error", "dependency-missing", `${billing}/README.md`, 9, "spec:identity:users/profile: пространство identity не объявлено в dependencies"),
    ]);
    expect(r.summary).toEqual({ errors: 5, warnings: 5, infos: 0, files: 10 });
    expect(r.code).toBe(1);
  });
});

describe("a decision registry in several roots", () => {
  const app = "app/openspec/README.md";
  const decision = (id: string) => `shared/decisions/${id}.md`;

  it("reports inactive, dangling and malformed decisions and resolves them across roots", () => {
    const r = uncovered("decisions");
    expect(r.findings).toEqual([
      at("error", "decision-inactive-ref", app, 4, "spec:shared:decision/0001-rest: решение заменено: 0001-rest → 0002-grpc → 0003-events", [
        [decision("0002-grpc"), 1],
        [decision("0003-events"), 1],
      ]),
      at("error", "decision-inactive-ref", app, 5, "spec:shared:decision/0004-sessions: решение отменено"),
      at("error", "ref-dangling", app, 6, "spec:shared:decision/0042-nope: решения нет"),
      at("error", "decision-inactive-ref", app, 8, "spec:shared:decision/0006-ghost: решение заменено: 0006-ghost → 0099-none"),
      at("warning", "decision-no-rationale", decision("0005-cache"), 1, "решение 0005-cache без обоснования"),
      at("error", "decision-supersede-missing", decision("0006-ghost"), 1, "решение 0006-ghost заменено несуществующим 0099-none"),
      at("error", "decision-supersede-cycle", decision("0007-ping"), 1, "цикл замен: 0007-ping → 0008-pong → 0007-ping"),
      at("error", "decision-supersede-cycle", decision("0008-pong"), 1, "цикл замен: 0008-pong → 0007-ping → 0008-pong"),
      at("error", "decision-status-invalid", decision("0009-draft"), 1, "решение 0009-draft: статус draft, ожидается active | superseded | revoked"),
      at("error", "decision-status-invalid", decision("0010-half"), 1, "решение 0010-half: superseded без superseded-by"),
      at("error", "decision-status-invalid", decision("0011-mixed"), 1, "решение 0011-mixed: superseded-by при статусе active"),
    ]);
    expect(r.summary).toEqual({ errors: 10, warnings: 2, infos: 0, files: 14 });
    expect(r.code).toBe(1);
  });
});

describe("launch errors", () => {
  it("exits 2 when the openspec root is missing", () => {
    const r = run("no-such-repo");
    expect(r.stderr).toContain("корень не найден");
    expect(r.status).toBe(2);
  });

  it("exits 2 when speclint.json is not valid JSON", () => {
    const r = run("config-broken");
    expect(r.stderr).toContain("нечитаемая конфигурация");
    expect(r.status).toBe(2);
  });

  it("exits 2 when a configured root does not exist", () => {
    const r = run("config-missing-root");
    expect(r.stderr).toMatch(/корень не найден: .*services\/ghost\/openspec/);
    expect(r.status).toBe(2);
  });

  it("exits 2 when tests in speclint.json is not a list of globs", () => {
    const r = run("config-bad-tests");
    expect(r.stderr).toContain("tests — список glob-шаблонов");
    expect(r.status).toBe(2);
  });

  it("exits 2 when two roots share a space", () => {
    const r = run("config-duplicate-space");
    expect(r.stderr).toContain("пространство core у двух корней");
    expect(r.status).toBe(2);
  });
});

describe("coverage by test marks", () => {
  it("reads marks from test files in four languages, skips non-test and vendored files and warns on untested scenarios", () => {
    const r = report("coverage");
    expect(r.findings).toEqual([
      at("error", "test-ref-dangling", "backend/src/test/kotlin/SignInTest.kt", 6, "spec:auth/login: требование переименовано в spec:auth/sign-in (rename-login)", [
        ["openspec/changes/archive/2026-01-10-rename-login/specs/auth/spec.md", 2],
      ]),
      at("error", "test-ref-dangling", "ios/AppTests/SessionTests.swift", 4, "spec:auth/legacy-login: требование удалено архивным изменением drop-legacy", [
        ["openspec/changes/archive/2026-03-01-drop-legacy/specs/auth/spec.md", 2],
      ]),
      at("error", "test-ref-dangling", "ml/tests/test_session.py", 1, "spec:auth/session-timout: требования нет в auth"),
      at("error", "dependency-missing", "ml/tests/test_session.py", 6, "spec:billing:invoices/create: пространство billing не объявлено в dependencies"),
      at("warning", "scenario-untested", "openspec/specs/auth/spec.md", 26, "сценарий auth/session-timeout#absolute-timeout без теста"),
      at("error", "test-ref-dangling", "web/src/session.test.ts", 5, "spec:decision/0001-cookies: решение заменено: 0001-cookies → 0002-tokens", [
        ["openspec/decisions/0002-tokens.md", 1],
      ]),
    ]);
    expect(r.summary).toEqual({ errors: 5, warnings: 1, infos: 0, files: 12 });
    expect(r.code).toBe(1);
  });

  it("takes test files from tests in speclint.json and gives a mark without space to the nearest root", () => {
    const r = report("coverage-monorepo");
    expect(r.findings).toEqual([
      at("error", "test-ref-dangling", "e2e/checks/flow.test.ts", 2, "spec:invoices/create: тест вне корней, нужен адрес с пространством"),
      at("error", "test-ref-dangling", "services/auth/checks/SignInCheck.kt", 5, "spec:invoices/create: capability нет"),
    ]);
    expect(r.summary).toEqual({ errors: 2, warnings: 0, infos: 0, files: 5 });
  });
});

describe("several repositories linked by published manifests", () => {
  const cli = (...args: string[]) => spawnSync("node", [new URL("../dist/cli.js", import.meta.url).pathname, ...args], { encoding: "utf8" });
  const readme = "openspec/README.md";
  const dep = "; зависимость identity 1.4.0";

  it("builds a deterministic manifest of the repository with addresses, statuses, decisions and coverage", () => {
    const r = cli("manifest", fixture("multirepo/identity"), "--release", "1.4.0");
    expect(r.stdout).toBe(readFileSync(fixture("multirepo/web/speclint/identity.manifest.json"), "utf8"));
    expect(r.status).toBe(0);
  });

  it("checks references and test marks against the manifest of a pinned dependency", () => {
    const r = report("multirepo/web");
    expect(r.findings).toEqual([
      at("error", "ref-dangling", readme, 4, `spec:identity:auth/sesion-timeout: требования нет в auth${dep}`),
      at("error", "ref-dangling", readme, 5, `spec:identity:auth/login: требование переименовано в spec:identity:auth/log-in (rename-login)${dep}`),
      at("error", "ref-archived", readme, 6, `spec:identity:auth/legacy-login: требование удалено архивным изменением drop-legacy${dep}`),
      at("error", "decision-inactive-ref", readme, 7, `spec:identity:decision/0007-jwt: решение заменено: 0007-jwt → 0012-paseto${dep}`),
      at("error", "decision-inactive-ref", readme, 8, `spec:identity:decision/0003-cookies: решение отменено${dep}`),
      at("error", "ref-archived", readme, 10, `spec:identity:change/drop-legacy: изменение в архиве${dep}`),
      at("error", "ref-dangling", readme, 11, `spec:identity:auth/two-factor: требования нет в auth${dep}`),
      at("info", "ref-external-unchecked", readme, 12, "spec:legacy:anything/x: пространство legacy без манифеста, не проверяется"),
      at("error", "dependency-missing", readme, 13, "spec:ghost:a/b: манифест ghost не найден: speclint/ghost.manifest.json"),
      at("error", "dependency-missing", readme, 14, "spec:billing:invoices/create: пространство billing не объявлено в dependencies"),
      at("warning", "scenario-untested-anywhere", "openspec/specs/checkout/spec.md", 15, "сценарий checkout/pay#wallet без теста ни в одном известном репозитории"),
      { ...at("warning", "scenario-untested-anywhere", "speclint/identity.manifest.json", 0, "сценарий identity:auth/session-timeout#remember-me без теста ни в одном известном репозитории"), line: null },
      at("error", "test-ref-dangling", "src/checkout.test.ts", 2, `spec:identity:auth/log-out: требования нет в auth${dep}`),
    ]);
    expect(r.summary).toEqual({ errors: 10, warnings: 2, infos: 1, files: 4 });
    expect(r.code).toBe(1);
  });

  it("keeps unchecked spaces as info and scenario-untested without known manifests", () => {
    const r = report("multirepo/identity");
    expect(r.findings).toEqual([
      at("warning", "scenario-untested", "openspec/specs/auth/spec.md", 15, "сценарий auth/session-timeout#absolute-timeout без теста"),
      at("warning", "scenario-untested", "openspec/specs/auth/spec.md", 19, "сценарий auth/session-timeout#remember-me без теста"),
      at("info", "ref-external-unchecked", "src/test/kotlin/SessionTest.kt", 10, "spec:web:checkout/pay#card: пространство web без манифеста, не проверяется"),
    ]);
    expect(r.code).toBe(0);
  });

  it("exits 2 when the manifest version differs from the pinned one", () => {
    const r = run("multirepo/web-stale");
    expect(r.stderr).toContain("манифест identity: версия 1.4.0, зафиксирована 1.3.0");
    expect(r.status).toBe(2);
  });

  it("exits 2 when manifest has no release version or a root has no space", () => {
    expect(cli("manifest", fixture("multirepo/identity")).stderr).toContain("нужен --release");
    const r = cli("manifest", fixture("clean"), "--release", "1.0.0");
    expect(r.stderr).toContain("у корня openspec нет пространства");
    expect(r.status).toBe(2);
  });
});
