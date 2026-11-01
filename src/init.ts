import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const FILES: Record<string, string> = {
  "speclint.json": `${JSON.stringify({ roots: [{ path: "openspec/app", space: "app", class: "core", uses: [] }] }, null, 2)}\n`,
  "openspec/app/specs/example/spec.md": `# example Specification

## Requirements

### Requirement: Greet
The app SHALL greet the user by name.

#### Scenario: Known user
- **WHEN** the user Ann opens the app
- **THEN** the app shows "Hello, Ann"
`,
  "example_test.go": `package example

import "testing"

// spec:app:example/greet#known-user
func TestGreetKnownUser(t *testing.T) {
	t.Run("WHEN the user Ann opens the app", func(t *testing.T) {})
	t.Run(\`THEN the app shows "Hello, Ann"\`, func(t *testing.T) {})
}
`,
};

export const init = (path: string): string | null => {
  const taken = Object.keys(FILES).find((f) => existsSync(join(path, f)));
  if (taken) return taken;
  for (const [file, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(path, file)), { recursive: true });
    writeFileSync(join(path, file), text);
  }
  return null;
};
