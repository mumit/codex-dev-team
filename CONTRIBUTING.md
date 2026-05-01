# Contributing

## Prerequisites

- Node.js 20+
- Git
- rsync (for bootstrap.sh)

## Setup

```bash
git clone https://github.com/mumit-khan/codex-dev-team.git
cd codex-dev-team
npm install
```

## Running Tests

```bash
npm test                    # all unit tests (gate-validator, budget, visualize, etc.)
```

All tests use Node's built-in `node:test` runner — no external test framework needed.

## Running Lint

```bash
npm run lint                # syntax checks on all .codex/ rule and schema files
```

The lint step validates YAML/JSON syntax in rule files and checks that all
gate schema files are valid JSON. It does not enforce style — keep your
changes consistent with the surrounding code.

## Running Parity Check

```bash
npm run parity:check        # deep parity checks (125+ tests)
```

The parity check compares `codex-dev-team` structural coverage against the
`claude-dev-team` reference. It exercises gate schema contracts, stage
ordering, track contracts, role presence, and adapter coverage.

Run this after any change to stage ordering, gate schemas, role definitions,
or track contracts. The check does not require `claude-dev-team` to be
checked out — all reference data is baked into `scripts/parity-check.js`.

## Project Structure

This is a **framework/template**, not an application. There is no `src/`
directory in the repo itself — `src/` is created by `bootstrap.sh` when
installing into a target project.

| Path | Purpose |
|------|---------|
| `.codex/adapters/` | Deployment adapter instructions |
| `.codex/prompts/roles/` | Role prompts (PM, Principal, 3 devs, QA, Security, Reviewer) |
| `.codex/rules/` | Pipeline rules, gate schema, escalation, orchestrator |
| `.codex/skills/` | Shared skill definitions |
| `pipeline/` | Runtime pipeline state (gates, context, artifacts) |
| `schemas/` | JSON Schema files for gate contracts |
| `scripts/` | CLI scripts (codex-team.js, gate-validator.js, budget.js, etc.) |
| `templates/` | Artifact templates for each stage |
| `tests/` | Unit tests |
| `bootstrap.sh` | Installs the framework into an existing project |

See `AGENTS.md` for the full role and command reference.

## Making Changes

1. Make your changes on a feature branch.
2. Run `npm test` to verify existing tests pass.
3. Run `npm run lint` to verify syntax.
4. Run `npm run parity:check` if you changed stages, gates, roles, or tracks.
5. Add tests for new functionality in `tests/`.
6. Open a PR against `main`.

## Testing Conventions

- Tests live in `tests/` with the naming pattern `*.test.js`.
- Use `node:test` (`describe`, `it`, `beforeEach`, `afterEach`) and
  `node:assert/strict`.
- No external test dependencies.
- For scripts, spawn them as child processes and assert on exit codes and stdout.
- Create a temp directory in `beforeEach` and remove it in `afterEach` — never
  write test artifacts into the repo root.

Example pattern:

```js
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

describe("my script", () => {
  let tmp;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mytest-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("does the thing", () => {
    const result = spawnSync(process.execPath, [
      path.join(ROOT, "scripts", "my-script.js"),
    ], { cwd: tmp, encoding: "utf8" });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /expected output/);
  });
});
```

## Bootstrap Script

`bootstrap.sh` copies the framework into an existing project. If you modify it:

- Verify it is idempotent — running twice should not break anything.
- `.codex/` is overwritten on every run (framework-owned).
- `AGENTS.md` is created only if missing (project-owned).
- `*.local.*` files and `settings.local.json` are always preserved.

## Adding a New Script

1. Create `scripts/<name>.js`.
2. Add a `npm run <name>` entry in `package.json`.
3. Wire the command into `scripts/codex-team.js` main dispatch.
4. Update the `doctor()` check array in `codex-team.js` if the script must
   be present in every installed project.
5. Add tests in `tests/<name>.test.js`.

## Adding a New Gate Stage

1. Add the schema to `schemas/stage-NN.schema.json`.
2. Add the stage-specific fields to `.codex/rules/gates.md`.
3. Add the stage config to the `STAGES` object in `scripts/codex-team.js`.
4. Update `orderedStageNames()` and `orderedStageNamesForTrack()` if the
   stage is added to a track.
5. Run `npm run parity:check` — if it fails, update `scripts/parity-check.js`
   to reflect the new expected state.

## Stage Numbering Note

Codex Dev Team uses **collapsed stage numbering** that differs from
`claude-dev-team`:

| claude-dev-team | codex-dev-team | Name |
|----------------|----------------|------|
| Stage 4.5a | Stage 5a | Pre-review (lint/SCA) |
| Stage 4.5b | Stage 5b | Security review (conditional) |
| Stage 5 | Stage 6 | Peer code review |
| Stage 6 | Stage 7 | QA / tests |
| Stage 7 | Stage 8 | Sign-off and deploy |
| Stage 8 | — | (merged into Stage 8) |
| Stage 9 | Stage 9 | Retrospective |

The intent is that codex stages run 1–9 without decimal suffixes. Do **not**
change this numbering — it is intentionally collapsed. See
[`docs/parity/claude-dev-team-parity.md`](docs/parity/claude-dev-team-parity.md)
for the Stage Numbering Divergence section and full parity rationale.

When porting content from `claude-dev-team`, translate stage numbers according
to the table above.

## PR Conventions

- Keep PRs focused: one feature or fix per PR.
- Title format: `type: short description` (e.g. `feat: add budget tracking`,
  `fix: gate round-counter reset after reviewer change`).
- Reference the parity check output in the PR description if you changed stage
  contracts.
- All 125+ parity-check tests must pass before merge.
- Do not bump `VERSION` or `framework.version` in `package.json`/`.codex/config.yml`
  in feature PRs — version bumps happen in a dedicated release PR.
