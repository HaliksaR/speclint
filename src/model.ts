export type Root = { path: string; space: string | null };
export type Capability = { root: Root; id: string; file: string };
export type Scenario = { name: string; slug: string; line: number; steps: string[] };
export type Requirement = { capability: Capability; name: string; slug: string; line: number; scenarios: Scenario[] };
export type Change = { root: Root; id: string; archived: boolean; deltas: Delta[] };
export type Delta = {
  change: Change;
  capability: string;
  op: "added" | "modified" | "removed" | "renamed";
  requirement: string;
  to: string | null;
  file: string;
  line: number;
  scenarios: Scenario[];
};
export type Decision = { id: string; status: string; supersededBy: string | null; rationale: boolean; file: string };
export type Reference = { address: string; file: string; line: number; change: Change | null };
export type TestMark = { address: string; root: Root | null; file: string; line: number };
export type Corpus = {
  root: Root;
  capabilities: Capability[];
  requirements: Requirement[];
  changes: Change[];
  references: Reference[];
  decisions: Decision[];
  files: number;
};

export const slug = (name: string) =>
  name
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
