# Changelog

All notable changes to the `codex-dev-team` framework are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project follows [Semantic Versioning](https://semver.org/).

Per-release detail lives in [`docs/release-notes/`](docs/release-notes/). This file
is the index and the rolling `[Unreleased]` pointer — it stays thin so
`git log` diffs between tags are readable.

## Release map

| Release | Date | Scope |
|---|---|---|
| v1.0.0 | 2026-05-01 | Initial parity release — codex-native 9-stage pipeline, gate validator, all tracks |
| v1.1.0 | 2026-05-01 | Deepening commit `9eb7cc2` — correctness fixes and expanded documentation |
| v1.2.0 | Unreleased | Prose depth port, budget tracking, async checkpoints, pipeline visualization |

---

## [Unreleased] — v1.2.0

### Added
- `.codex/rules/pipeline.md` expanded to ~400 lines with full prose for
  review shape (scoped vs matrix), review file format, READ-ONLY Reviewer
  Rule, gate merge strategy, review round limit, Stage Duration Expectations,
  and Parallel Execution Model.
- `.codex/rules/gates.md` expanded to ~200 lines with Stage-Specific Extra
  Fields including concrete JSON examples for every codex stage, scoped vs
  matrix review shape JSON, Stage 08 auto-fold semantics, retry protocol, and
  ESCALATE shape examples.
- `.codex/rules/coding-principles.md` expanded to ~110 lines with numbered
  principles, "what TO do / what NOT to do" code examples, and a Precedence
  section.
- `.codex/rules/execution-profiles.md` expanded to ~80 lines covering the
  three execution profiles (`local`, `app_worktree`, `cloud`) in detail,
  including a "Parallelism in Stage 4" subsection.
- `EXAMPLE.md` at repo root — end-to-end pipeline walkthrough for "Add
  password reset via email", covering Stages 1–9 with real artifact excerpts.
- `CHANGELOG.md` at repo root — version history following Keep a Changelog.
- `CONTRIBUTING.md` at repo root — local dev setup, test/lint/parity commands,
  PR conventions, and stage numbering note.
- `scripts/budget.js` — budget tracking implementation: `init`, `update`,
  `check` subcommands. Writes `pipeline/budget.md`, appends per-stage rows,
  and checks totals against config maxima (escalate or warn). No-op when
  `budget.enabled: false`.
- `scripts/visualize.js` — Mermaid stateDiagram-v2 generator. Reads active
  track stages and gate files, colors by status (PASS=green, FAIL=red,
  ESCALATE=orange, missing=gray), writes `pipeline/diagram.md`.
- `scripts/codex-team.js`: `budget` and `visualize` subcommands wired in.
- Checkpoint auto-pass logic in `scripts/codex-team.js`:
  `applyCheckpointAutoPass()` called after gate writes; supports
  `no_warnings` and `all_criteria_passed` conditions; suppressed when
  stoplist triggers appear in `pipeline/context.md`.
- `tests/budget.test.js` — init, update, check (escalate/warn), disabled
  no-op paths.
- `tests/checkpoints.test.js` — each condition, null default, security
  stoplist override.
- `tests/visualize.test.js` — empty/active/complete pipeline diagrams, valid
  Mermaid syntax.
- `npm run budget` and `npm run visualize` scripts in `package.json`.

---

## v1.1.0 — 2026-05-01

Deepening commit `9eb7cc2 feat: deepen claude-dev-team parity`.

### Fixed
- **Role definitions** fleshed out to 1,287 lines with full working rules and
  output formats for every role.
- **Audit phases** reference added (264 lines) covering quick, full, and
  health-check audit modes.
- **Budget gate** — `.codex/config.yml` now has `budget.enabled`, `tokens_max`,
  `wall_clock_max_minutes`, and `on_exceed` fields.
- **Async checkpoints** — `.codex/config.yml` now has `checkpoints.a/b/c`
  with `auto_pass_when` conditions.
- **Stoplist enforcement** — `.codex/rules/pipeline.md` Stage 0 documents the
  six stoplist triggers that force the full track.
- **Approval locking** — `scripts/approval-derivation.js` uses atomic file
  writes to prevent race conditions when the hook fires concurrently.
- **Parity check** — `scripts/parity-check.js` performs deep structural checks;
  125 tests passing at time of this release.

---

## v1.0.0 — 2026-05-01

Initial release of the `codex-dev-team` framework. Establishes parity with
`claude-dev-team` v2.5.1 for the core pipeline features, translated to
Codex-native conventions.

### Added
- 9-stage deterministic delivery pipeline (Requirements → Design →
  Clarification → Build → Pre-review → Peer Review → QA → Sign-off + Deploy →
  Retrospective).
- Six pipeline tracks: `full`, `quick`, `nano`, `config-only`, `dep-update`,
  `hotfix`.
- Gate validator (`scripts/gate-validator.js`) with bypassed-escalation sweep,
  retry integrity, required-field checks, and track advisory.
- Approval derivation hook (`scripts/approval-derivation.js`) — parses review
  file markers and reconciles per-area gates. Agents may not self-approve.
- Security heuristic (`scripts/security-heuristic.js`) — triggers Stage 5b
  security review on auth/crypto/PII/secret paths and new deps.
- Runbook check (`scripts/runbook-check.js`) — enforces `## Rollback` and
  `## Health signals` sections before deploy.
- Lessons system (`scripts/lessons.js`) — promotes LESSON: lines from
  retrospective files into `pipeline/lessons-learned.md`.
- Consistency checker (`scripts/consistency.js`) — validates cross-stage
  artifact and gate consistency.
- Audit system (`scripts/audit.js`) — full, quick, and health-check modes.
- Status, summary, and roadmap scripts.
- Complete role prompts under `.codex/prompts/roles/`.
- Six deployment adapters under `.codex/adapters/`.
- Schema-backed gate contracts under `schemas/`.
- Bootstrap script (`scripts/bootstrap.js` + `bootstrap.sh`) for installing
  the framework into a target project.
- Parity check script (`scripts/parity-check.js`) with 125 tests covering
  structural and content parity with `claude-dev-team`.

---

## How to add a new release entry

1. Create `docs/release-notes/vX.Y.Z.md` following the shape of
   [`docs/release-notes/v1.0.0.md`](docs/release-notes/v1.0.0.md).
2. Add a row to the release map table above (reverse chronological).
3. Move the relevant `[Unreleased]` entries into the release file,
   leaving `[Unreleased]` empty or listing only changes not yet released.
4. Bump `VERSION` at repo root and `framework.version` in `.codex/config.yml`
   (they must match).
5. Tag the merge commit `vX.Y.Z`.

---

## Version-compare links

[Unreleased]: https://github.com/mumit-khan/codex-dev-team/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/mumit-khan/codex-dev-team/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mumit-khan/codex-dev-team/releases/tag/v1.0.0
