export type Finding = {
  level: "error" | "warning" | "info";
  rule: string;
  file: string | null;
  line: number | null;
  message: string;
  related: { file: string; line: number | null }[];
};

const hasErrors = (findings: Finding[]) => findings.some((f) => f.level === "error");

export const exitCode = (findings: Finding[]): number => (hasErrors(findings) ? 1 : 0);

const count = (findings: Finding[], level: Finding["level"]) => findings.filter((f) => f.level === level).length;

export const jsonReport = (version: string, findings: Finding[], files: number) =>
  JSON.stringify(
    {
      tool: "speclint",
      version,
      status: hasErrors(findings) ? "findings" : "ok",
      findings,
      summary: {
        errors: count(findings, "error"),
        warnings: count(findings, "warning"),
        infos: count(findings, "info"),
        files,
      },
    },
    null,
    2,
  );

export const textReport = (findings: Finding[], files: number) =>
  findings.map((f) => `${f.file ?? ""}:${f.line ?? ""}: ${f.level} ${f.rule}: ${f.message}\n`).join("") +
  `speclint: ошибок ${count(findings, "error")}, предупреждений ${count(findings, "warning")}, файлов ${files}`;
