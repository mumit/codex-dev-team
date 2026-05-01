# Pipeline

The Codex Dev Team pipeline is a deterministic delivery workflow. It can run
locally, in a Codex app worktree, or as delegated cloud tasks.

## Stage 0 — Routing and Budget

Before Stage 1, the orchestrator decides which track to run and (optionally)
initialises budget tracking.

### Safety stoplist

The full track is mandatory for any change that touches:
- Authentication, authorization, or session handling
- Cryptography, key management, or secrets rotation
- PII, payments, or regulated-data handling
- Schema migrations or destructive data changes
- Feature-flag introduction (toggling existing flags is fine in config-only)
- New external dependencies (upgrades are fine in dep-update)

The lighter tracks (quick, nano, config-only, dep-update) must not be used
to bypass this list. When uncertain, default to full.

The routing decision is recorded in `pipeline/context.md` under `## Brief
Changes` as `TRACK: <name>` with a one-line rationale. Each gate file in
`pipeline/gates/` includes `"track": "<name>"` in its body so the
gate-validator and downstream tooling can branch on track.

### Budget gate (opt-in)

If `.codex/config.yml` has `budget.enabled: true`, the orchestrator writes
`pipeline/budget.md` at run start with zero counters and updates it at every
stage boundary:

```markdown
# Budget

Started: <ISO>
Tokens max: 500000
Wall-clock max: 90 min

## Running totals
| Stage | Tokens | Elapsed (min) |
|-------|--------|---------------|
| requirements | 12000 | 3.2 |
| design       | 45000 | 8.7 |
| ...          | ...   | ... |
```

After each stage gate passes, the orchestrator checks the running totals
against the configured maximums. On exceed:

- `on_exceed: escalate` — write `pipeline/gates/stage-budget.json` with
  `status: ESCALATE`, `escalation_reason: "Budget exceeded — <tokens |
  wall-clock>"`, and `decision_needed: "Continue (override budget), or halt
  and inspect?"`. The orchestrator halts.
- `on_exceed: warn` — log the breach and continue the pipeline. Useful for
  calibration runs where the team is still tuning limits.

Token counts are best-effort — the orchestrator sums reported usage where
available, otherwise estimates from character counts. This is a guardrail,
not a cryptographic limit.

When `budget.enabled: false` (default), no tracking happens.

### Async-friendly checkpoints (opt-in)

By default the pipeline halts at Checkpoints A (after requirements), B
(after design), and C (after QA) waiting for a human `proceed`. Teams can
pre-approve a checkpoint when a precondition holds, configured in
`.codex/config.yml`:

```yaml
checkpoints:
  c:
    auto_pass_when: all_criteria_passed
```

Supported conditions:

- `null` / absent — always wait for human (default; current behaviour)
- `no_warnings` — auto-pass if the stage gate has zero warnings
- `all_criteria_passed` — auto-pass if `stage-07.json` has
  `all_acceptance_criteria_met: true` AND
  `criterion_to_test_mapping_is_one_to_one: true` (Checkpoint C only)

Auto-pass writes a record to `pipeline/context.md` under `## User Decisions`
as:

```
<ISO> — CHECKPOINT-AUTO-PASS: <a|b|c> (<condition>)
```

Never auto-pass security-sensitive work. The safety stoplist above remains
the hard guard — auto-pass at checkpoints does not override it. If
`pipeline/context.md` contains any stoplist trigger keyword, auto-pass is
suppressed regardless of the configured condition.

---

## Tracks

| Track | Use for | Review |
|---|---|---|
| full | Cross-area features | Matrix review |
| quick | Small scoped code changes | One reviewer |
| nano | Trivial single-file edits | Regression check only |
| config-only | Configuration value changes | Platform review |
| dep-update | Dependency upgrades | QA + security-sensitive checks |
| hotfix | Urgent production bugs | Expedited review |

The rules below describe the **full** track. Lighter-track deltas live in the
track's own command file (`.codex/commands/{track}.md`). When a gate in a
lighter track differs from the full-track definition (for example, Stage 6
needing only one approval in `quick`), the track file overrides the rule here
— the track file is authoritative for its own track.

---

## Stages

1. **Requirements** — PM writes `pipeline/brief.md` and Stage 1 gate.
2. **Design** — Principal writes `pipeline/design-spec.md` and ADRs.
3. **Clarification** — unresolved questions in `pipeline/context.md` are answered.
4. **Build** — implementation happens in role-owned areas.
5. **Pre-review** — lint, type-check, dependency audit, and conditional security.
6. **Peer Review** — reviewers write `pipeline/code-review/by-<role>.md`.
7. **QA** — QA writes tests and `pipeline/test-report.md`.
8. **Sign-off and Deploy** — PM sign-off, then deployment when requested.
9. **Retrospective** — lessons are added to `pipeline/lessons-learned.md`.

---

## Stage 1 — Requirements (PM)

Invoke: `pm` agent
Input: user's feature request
Output: `pipeline/brief.md`
Gate file: `pipeline/gates/stage-01.json`
Gate key: `"status": "PASS"`

The PM defines acceptance criteria and scope. Engineers do not begin design
until the gate passes. After gate passes → **HUMAN CHECKPOINT A**.

---

## Stage 2 — Design (Principal + Dev input)

Step 2a — Principal drafts:
  Input: `pipeline/brief.md`
  Output: `pipeline/design-spec.md` (status: DRAFT)

Step 2b — Dev annotation (parallel, read-only):
  Each dev appends concerns to `pipeline/design-review-notes.md`.
  These are read-only passes — no code written yet.

Step 2c — Principal chairs review:
  Input: `pipeline/design-spec.md` + `pipeline/design-review-notes.md`
  Output: updated `pipeline/design-spec.md`, ADR files in `pipeline/adr/`
  Gate file: `pipeline/gates/stage-02.json`
  Gate keys: `"arch_approved": true` AND `"pm_approved": true`

After both approvals → **HUMAN CHECKPOINT B**.

---

## Stage 3 — Pre-Build Clarification

Check `pipeline/context.md` for any lines starting with `QUESTION:` that
lack a `PM-ANSWER:`. If any exist, invoke `pm` agent to answer them before
proceeding. If none, proceed immediately.

---

## Stage 4 — Build (parallel role workstreams)

Invoke in parallel (using Codex app worktrees or cloud task fan-out —
see Execution Profiles):

  `dev-backend`  → `src/backend/`  → `pipeline/pr-backend.md`
  `dev-frontend` → `src/frontend/` → `pipeline/pr-frontend.md`
  `dev-platform` → `src/infra/`    → `pipeline/pr-platform.md`

Gate file per PR: `pipeline/gates/stage-04-{area}.json`
All three must have `"status": "PASS"` before proceeding.

---

## Stage 5 — Pre-review checks

Between Stage 4 (build) and Stage 6 (peer code review), two automated
gates must pass. These catch issues the toolchain already knows about
before reviewer attention is spent on them.

### Stage 5a — Pre-review gate (lint + type-check + SCA)

Invoke: `dev-platform` role.
Scope: lint, type-check, dependency vulnerability scan, license allowlist.
Output: `pipeline/gates/stage-05.json`.
Gate key: `"status": "PASS"` with `"lint_passed": true`,
`"tests_passed": true`, and no `high`/`critical` SCA findings.

On failure, the owning dev (identified from the failing check) is re-invoked
to fix. Stage 6 does not start until this gate passes.

### Stage 5b — Security review (conditional)

Invoke the `security` role **only when** the triggering heuristic fires. The
heuristic matches any of:

- Paths: `src/backend/auth*`, `src/backend/crypto*`, `src/backend/payment*`,
  `src/backend/pii*`, `src/backend/session*`, or any file named with
  `*secret*` / `*token*` / `*credential*`
- New or upgraded dependencies in `package.json`, `requirements.txt`, etc.
- Changes to `Dockerfile` or `docker-compose*.yml` that add/modify a service
  image, network, or volume
- Files under `src/infra/` that affect network topology, IAM/RBAC,
  TLS/certificates, secrets management, or CI/CD secret handling
- New or changed database migrations
- New environment variables or secret references in `.env.example`

If the heuristic does not fire, the security gate is skipped and the
orchestrator records the skip decision in `pipeline/context.md` under
`## Brief Changes` as `SECURITY-SKIP: <reason>`.

A `veto: true` gate halts the pipeline. No peer-review approval can override
a veto — the security reviewer must personally re-review the fix and flip the
flag.

Both 5a and 5b must pass (when applicable) before Stage 6 begins.

---

## Stage 6 — Peer Code Review

### Review shape — scoped vs matrix

Before Stage 6 begins, the orchestrator inspects the diff and picks one
of two review shapes, then writes the chosen shape into each stage-06
gate's `"review_shape"` and `"required_approvals"` fields.

**Scoped review** — `review_shape: "scoped"`, `required_approvals: 1`.

Used when the diff is **area-contained**: every changed file lives under
one of `src/backend/`, `src/frontend/`, `src/infra/`, or `src/tests/`,
with no cross-area edits. One reviewer from a different area is sufficient.
The pairing convention:

| Owning area     | Default reviewer     |
|-----------------|----------------------|
| `src/backend/`  | `dev-platform`       |
| `src/frontend/` | `dev-backend`        |
| `src/infra/`    | `dev-backend`        |
| `src/tests/`    | `dev-backend`        |

**Gate pre-creation (required for scoped reviews).** Before invoking the
reviewer, the orchestrator must write `pipeline/gates/stage-06-{area}.json`
with `"required_approvals": 1` and `"review_shape": "scoped"`. The
`approval-derivation.js` hook defaults newly-created gates to
`required_approvals: 2`. If the gate doesn't pre-exist with the correct
value, the hook creates a matrix gate and a single approval never flips the
status to PASS.

**Matrix review** — `review_shape: "matrix"`, `required_approvals: 2`.

Used when the diff touches more than one area. The original matrix applies:
  `dev-backend`  reviews: frontend + platform → writes `pipeline/code-review/by-backend.md`
  `dev-frontend` reviews: backend + platform  → writes `pipeline/code-review/by-frontend.md`
  `dev-platform` reviews: backend + frontend  → writes `pipeline/code-review/by-platform.md`

Each area's stage-06 gate accumulates two approvals from reviewers whose
own area is different.

### Review file format

Reviewers write per-area sections inside their review file, each ending with
a `REVIEW: APPROVED` or `REVIEW: CHANGES REQUESTED` marker on its own line:

```markdown
# Review by <reviewer-name>

## Review of backend
<comments, BLOCKER/SUGGESTION/QUESTION entries>

REVIEW: APPROVED

## Review of platform
<comments>

REVIEW: CHANGES REQUESTED
BLOCKER: <text>
```

The `approval-derivation.js` hook parses these sections after the reviewer
writes the file and updates `pipeline/gates/stage-06-<area>.json`
accordingly. **Agents no longer author the `approvals` or `changes_requested`
fields directly** — the hook is the single writer.

### READ-ONLY Reviewer Rule (strictly enforced)

During a Stage 6 review invocation, a reviewer agent writes ONLY to:
  - `pipeline/code-review/by-{reviewer}.md` (their review file)
  - `pipeline/gates/stage-06-{area}.json` (append-only approval gate)

A reviewer agent MUST NOT:
  - Use `Write` or `Edit` on any file under `src/`
  - Amend or refactor the author's code, even for a "one-line obvious fix"
  - Add themselves to `approvals` in a stage-06 gate if they modified any
    source file during the same invocation — the gate is then invalid

If the reviewer finds a bug or other BLOCKER: they write
`REVIEW: CHANGES REQUESTED` in their review file, list the blocker, and
halt. The orchestrator re-invokes the owning dev role to fix it in their
own workstream.

Rationale: silent inline fixes bypass the owning dev, skip re-review of
the patched lines, and leave no audit trail tying the patch to a
CHANGES-REQUESTED → addressed loop.

### Gate merge strategy (hook-derived)

Each area gate (`pipeline/gates/stage-06-{area}.json`) accumulates approvals
via `approval-derivation.js`, not via agent self-write. The gate reaches
`"status": "PASS"` when:

- `approvals.length >= required_approvals` (1 for scoped, 2 for matrix)
- `changes_requested` is empty

An agent that manually edits the `approvals` array is running around the
integrity model. The hook runs on every file save and reconciles the gate to
the review file; any direct edit will be overwritten on the next reviewer's
file save. Don't fight it.

### Review round limit

To prevent an unbounded review-fix spiral, the orchestrator enforces a
**two-round maximum** per area per pipeline run:

- **Round 1**: reviewer writes `CHANGES REQUESTED` → owning dev fixes →
  reviewer re-reviews.
- **Round 2**: if the same reviewer writes `CHANGES REQUESTED` again on the
  same area, the orchestrator **must not** invoke the dev a third time.
  Instead it invokes `principal` with the two review files, the dev's PR
  file, and the brief and design spec.

The Principal makes a binding ruling: either the blocker is resolved (dev
implements Principal's ruling and the reviewer approves), or the pipeline
FAILs with an explicit rejection. The round counter resets if a different
reviewer takes over the area. Record the escalation in `pipeline/context.md`
as `REVIEW-ESCALATED: <area> after 2 rounds — principal ruling requested`.

Pre-read requirement (pass to each reviewer):
  - `pipeline/brief.md`
  - `pipeline/design-spec.md`
  - `pipeline/adr/` (all files)
  - The other reviewer's file if already written (sequential fallback)

On architectural escalation or deadlock: invoke `principal`. Principal ruling
is binding.

---

## Stage 7 — QA

Invoke: `dev-qa` role
Input: `src/` + `pipeline/brief.md` (acceptance criteria)
Output: `pipeline/test-report.md`
Gate file: `pipeline/gates/stage-07.json`
Gate keys:
- `"status": "PASS"` with `"all_acceptance_criteria_met": true`
- `"criterion_to_test_mapping_is_one_to_one": true | false` — this drives
  the Stage 8 auto-fold

On failure: identify owning dev from the failing test's path (dev-qa writes
`"assigned_retry_to"` in the gate), invoke that dev with the failure context.
Retry limit: 3 cycles. On 3rd identical failure, auto-escalate to `principal`.

After gate passes → **HUMAN CHECKPOINT C**.

---

## Stage 8 — Sign-off and Deploy (adapter-driven)

Invoke: `dev-platform` role.
Preconditions:
- PM sign-off confirmed
- `pipeline/runbook.md` exists and has `## Rollback` + `## Health signals`
  sections
- `.codex/config.yml` names a valid adapter in `deploy.adapter`

Stage 8 is adapter-driven. The dev-platform role reads the selected adapter's
instructions from `.codex/adapters/<adapter>.md` and follows them.
Built-in adapters: `docker-compose` (default), `kubernetes`, `terraform`,
`custom`. See `.codex/adapters/README.md` for the contract.

Output:
- `pipeline/deploy-log.md` — human-readable, includes a runbook pointer
- `pipeline/gates/stage-08.json` — gate with fields `adapter`, `environment`,
  `smoke_test_passed`, `runbook_referenced`, and an adapter-specific
  `adapter_result` block

Gate key: `"status": "PASS"` AND `"runbook_referenced": true`.

On failure: do NOT auto-rollback. The deploy log points to the runbook's
`§Rollback` section; the orchestrator surfaces that pointer and the user
decides.

### Auto-fold from Stage 7

When Stage 7 maps every acceptance criterion 1:1 to a passing test and sets
`"all_acceptance_criteria_met": true`, the orchestrator auto-writes the PM
sign-off portion of Stage 8 without invoking the PM:

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "pm_signoff": true,
  "auto_from_stage_07": true,
  "track": "<track>",
  "agent": "orchestrator",
  "timestamp": "<ISO>",
  "blockers": [],
  "warnings": []
}
```

The auto-fold is skipped (and the PM invoked normally) when:
- `"all_acceptance_criteria_met"` is not `true` in Stage 7
- Stage 7 does not have a 1:1 criterion-to-test mapping
- The user explicitly requested a manual sign-off
- The track is `hotfix` (hotfixes always require PM sign-off)

Post-deploy: invoke `pm` role to write stakeholder summary.

---

## Stage 9 — Retrospective (all roles + Principal synthesis)

Full protocol: see `.codex/rules/retrospective.md`.

Runs automatically after Stage 8 (PASS or FAIL) and after any red halt.

Step 9a — Contribution (parallel, read-heavy):
  Invoke in parallel: `pm`, `principal`, `dev-backend`, `dev-frontend`,
  `dev-platform`, `dev-qa`. When Stage 5b fired, also invoke `security`.
  Each appends a section to `pipeline/retrospective.md` using the
  four-heading template. Each produces one concrete lesson.

Step 9b — Synthesis:
  Invoke: `principal`
  Input: `pipeline/retrospective.md` + `pipeline/lessons-learned.md`
  Output: synthesis block prepended to retrospective, updated
  `pipeline/lessons-learned.md` (max 2 promotions, retire rules proved
  wrong or reinforced ≥5 times without defect).
  Gate file: `pipeline/gates/stage-09.json`
  Gate key: `"status": "PASS"` (informational)

After gate: the orchestrator prints the synthesis block and the list of
promoted/retired lessons to the user. No checkpoint — pipeline ends here.

---

## Track Contracts

`npm run next` is track-aware. It infers the active track from
`CODEX_TEAM_TRACK`, existing gate files, or `pipeline/context.md`, then advances
only through the stages that track uses.

### full

Full track uses every stage in order. Stage 6 normally uses matrix review, but
pre-existing scoped gates remain valid when a run intentionally narrows review
area and approval count.

### quick

Quick track uses Requirements → Build → Peer Review → QA → Deploy →
Retrospective. Stage 6 review gates must be scoped reviews with
`required_approvals: 1`. `npm run pipeline:review` precreates quick scoped
review gates from existing `pipeline/pr-<area>.md` files.

### nano

Nano track uses Build → QA only. It must not write requirement, design,
clarification, pre-review, deploy, or retrospective gates. A PASS QA gate must
record `regression_check: "PASS"`.

### config-only

Config-only track uses Build → Pre-review → QA → Deploy. It records
`CONFIG-ONLY scope` in `pipeline/context.md`. A PASS QA gate must record
`regression_check: "PASS"`.

### dep-update

Dependency-update track uses Build → Peer Review → QA → Deploy. The review
area is `deps`, with a precreated `pipeline/gates/stage-06-deps.json` scoped
review gate requiring one approval. A PASS QA gate must record
`regression_check: "PASS"`.

### hotfix

Hotfix track uses Build → Pre-review → Peer Review → QA → Deploy →
Retrospective. It writes `pipeline/hotfix-spec.md`, records
`STAGE-4.5A-SKIP: hotfix track`, and still runs the conditional security check.
A PASS Stage 6 gate must record `stage_4_5a_skipped: true`.

---

## Stage Duration Expectations

Typical wall-clock targets for each stage on a full track run. These are
guidelines, not hard limits — the framework does not enforce timeouts on role
execution. If a stage seems stalled, use `npm run status` to check progress
and `npm run pipeline:context` for a full state dump.

| Stage | Typical Duration | Notes |
|-------|-----------------|-------|
| 1 — Requirements | 2–5 min | Single role (PM). Fast unless scope is ambiguous. |
| 2 — Design | 5–15 min | Sequential: draft → annotation → review. Longest non-build stage. |
| 3 — Clarification | <1 min | Pass-through if no open questions. |
| 4 — Build | 5–20 min | Parallel roles. Wall-clock = slowest workstream. Complexity-dependent. |
| 5 — Pre-review | 2–5 min | Automated checks. Depends on test suite and SCA scan speed. |
| 6 — Peer Review | 5–15 min | Reviewers reading peer PRs. Sequential fallback is slower. |
| 7 — QA | 3–10 min | Depends on test suite size and whether retries are needed. |
| 8 — Sign-off + Deploy | 3–10 min | Docker build + smoke tests. Network-dependent. |
| 9 — Retrospective | 3–8 min | Parallel contributions + Principal synthesis. |

**Full pipeline**: 28–88 minutes typical, depending on feature complexity.

**Stall indicators**:
- Stage 4 taking >30 min: check if a dev role hit an ambiguity and wrote a
  `QUESTION:` to `pipeline/context.md` without the orchestrator noticing.
- Stage 7 retry loops: check if the same test is failing repeatedly
  (auto-escalates after 3 identical failures).
- Any stage with no gate file written after 15 min: likely a context or
  permission issue. Check the role's output for errors.

---

## Parallel Execution Model

Stage 4 builds run as parallel role workstreams. How the parallelism is
realized depends on the execution profile — see
`.codex/rules/execution-profiles.md` for the full description.

**`local`**: roles run sequentially in the current checkout. Parallel
fan-out is simulated — each role's output files are staged before the next
role begins. Suitable for single-developer pairing sessions.

**`app_worktree`**: the Codex app creates isolated worktrees for each
build role. Roles receive disjoint write scopes and run concurrently. This
is the recommended profile for full-track runs where build parallelism
matters.

**`cloud`**: each Stage 4 role is dispatched as a self-contained cloud
task. The task prompt includes role, stage, files-to-read, allowed writes,
expected outputs, and verification commands. Tasks run independently and
return branch-ready diffs.

In all profiles, the orchestrator collects per-role gate files
(`pipeline/gates/stage-04-{area}.json`) before advancing to Stage 5. All
three must pass.

---

## Helper Commands

- `npm run quick -- "<change>"` starts a quick-track run.
- `npm run nano -- "<change>"` records a nano scope and starts the edit stage.
- `npm run config-only -- "<change>"` records config-only scope and starts platform edit.
- `npm run dep-update -- "<update>"` records dependency scope and starts platform edit.
- `npm run hotfix -- "<bug and fix>"` writes `pipeline/hotfix-spec.md` and starts build.
- `npm run review:derive` derives Stage 6 approval gates from review files.
- `npm run security:check -- <changed files>` decides whether security review is required.
- `npm run runbook:check` verifies `pipeline/runbook.md` before deploy.
- `npm run validate` runs syntax checks and latest-gate validation.
- `npm run budget -- init|update|check` manages budget tracking (opt-in).
- `npm run visualize` generates `pipeline/diagram.md` with Mermaid stateDiagram.

## Human Checkpoints

- Checkpoint A: after requirements (Stage 1)
- Checkpoint B: after design (Stage 2)
- Checkpoint C: after QA (Stage 7)

Checkpoint bypass requires an explicit user instruction or a configured
auto-pass condition in `.codex/config.yml`.
