import { spawnSync } from "node:child_process";
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
    expect(r.summary).toEqual({ errors: 0, warnings: 0, infos: 0, files: 6 });
    expect(r.code).toBe(0);
  });

  it("prints a one-line summary in text format", () => {
    const r = run("clean");
    expect(r.stdout.trim()).toBe("speclint: ошибок 0, предупреждений 0, файлов 6");
    expect(r.status).toBe(0);
  });
});

describe("references", () => {
  const readme = "openspec/README.md";
  const findings = () => report("refs").findings;

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

  it("marks external addresses as unchecked", () => {
    expect(findings()).toContainEqual(
      at("info", "ref-external-unchecked", readme, 11, "spec:billing:invoices/create: внешний адрес не проверяется до M5"),
    );
  });

  it("prints findings as file:line lines in text format", () => {
    expect(run("refs").stdout).toContain(`${readme}:3: error ref-dangling: spec:auth/session-timout: требования нет в auth\n`);
  });

  it("reports nothing else and exits 1", () => {
    const r = report("refs");
    expect(r.findings).toHaveLength(11);
    expect(r.summary).toEqual({ errors: 10, warnings: 0, infos: 1, files: 9 });
    expect(r.status).toBe("findings");
    expect(r.code).toBe(1);
  });
});

describe("deltas and addresses", () => {
  const auth = "openspec/specs/auth/spec.md";
  const delta = (change: string, cap = "auth") => `openspec/changes/${change}/specs/${cap}/spec.md`;

  it("reports the whole corpus in file and line order", () => {
    expect(report("deltas").findings).toEqual([
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

describe("launch errors", () => {
  it("exits 2 when the openspec root is missing", () => {
    const r = run("no-such-repo");
    expect(r.stderr).toContain("корень не найден");
    expect(r.status).toBe(2);
  });
});
