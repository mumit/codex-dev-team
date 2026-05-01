# Execution Profiles

The Codex Dev Team pipeline can run in three execution profiles. The profile
controls how roles are invoked, how Stage 4 parallelism is achieved, and what
a self-contained task prompt must include. Set the default in
`.codex/config.yml` under `execution.default_profile`.

---

## `local`

**Use when:** the user is actively pairing in a terminal, IDE, or Codex app
thread. All work happens in the current checkout.

**Characteristics:**
- Roles run sequentially in a single agent session.
- There are no worktrees or parallel sandboxes — each role's output files
  are staged before the next role begins.
- The user can inspect intermediate artifacts (brief, design spec, PR files)
  between stages and redirect before the next stage starts.
- Verification commands run in the same shell session.

**Stage 4 parallelism in `local`:** simulated. The orchestrator invokes
`dev-backend`, `dev-frontend`, and `dev-platform` in sequence. Role-owned
write scopes (`src/backend/`, `src/frontend/`, `src/infra/`) prevent
conflicts. Effective wall-clock time is the sum of the three workstreams,
not the maximum.

**Prompt requirements:** minimal — roles can reference the current
`pipeline/` state directly. No need for fully self-contained prompts.

**Best for:** single-developer sessions, debugging, step-by-step tracing of
pipeline behavior, small quick/nano/config-only runs.

---

## `app_worktree`

**Use when:** running in a Codex app session where isolated worktrees can be
created for each build role. Recommended for full-track runs where build
parallelism reduces wall-clock time.

**Characteristics:**
- The Codex app creates an isolated worktree for each Stage 4 build role.
- Roles receive disjoint write scopes and run concurrently as separate tasks.
- Each worktree starts from the same base commit, so roles cannot read each
  other's in-progress changes — design the interface contracts in Stage 2 so
  the worktrees are truly independent.
- After all three Stage 4 roles finish, the orchestrator merges outputs and
  validates per-area gate files before advancing.

**Stage 4 parallelism in `app_worktree`:** true fan-out. Three Codex tasks
run simultaneously in isolated worktrees:

```
worktree: feature/build-backend   → dev-backend role → pipeline/gates/stage-04-backend.json
worktree: feature/build-frontend  → dev-frontend role → pipeline/gates/stage-04-frontend.json
worktree: feature/build-platform  → dev-platform role → pipeline/gates/stage-04-platform.json
```

Effective wall-clock time is approximately the slowest workstream, not the
sum. On a typical feature this saves 10–30 minutes compared to `local`.

**Merge step:** after all three gates pass, the orchestrator merges worktree
outputs back into the main branch (or collects the diff patches). Conflicts
at the merge boundary indicate the role scopes were not truly disjoint — a
design issue to surface in the Stage 9 retro.

**Prompt requirements:** each task prompt must include:
- Role name and stage
- Files to read (brief, design spec, ADRs, context)
- Allowed write scope (area-specific `src/` path + PR file)
- Expected output files and gate file
- Verification commands

**Best for:** full-track feature development, teams that want genuine
parallel build, automated pipeline runs without active user pairing.

---

## `cloud`

**Use when:** tasks are delegated to a cloud sandbox running without an
active chat thread. Each task must be fully self-contained because it cannot
reference the current session context.

**Characteristics:**
- Tasks run in isolated cloud sandboxes.
- The sandbox has no access to the current chat session, prior messages,
  or agent memory.
- Every prompt must include all context needed to complete the task.
- Tasks return branch-ready diffs and a summary of tests run.
- The orchestrator collects results asynchronously.

**Stage 4 parallelism in `cloud`:** each Stage 4 build role is dispatched
as an independent cloud task. The task prompt must be entirely self-contained:

```
Role: dev-backend
Stage: stage-04 (Build — backend)
Track: full

Read these files:
  pipeline/brief.md
  pipeline/design-spec.md
  pipeline/adr/ (all files)
  pipeline/context.md

Allowed writes:
  src/backend/
  pipeline/pr-backend.md
  pipeline/gates/stage-04-backend.json

Expected outputs:
  pipeline/pr-backend.md  (PR description with ## Plan)
  pipeline/gates/stage-04-backend.json  (PASS gate with files_changed)

Verification:
  npm test -- --grep "auth"
  npm run lint
```

Cloud tasks must not assume access to secrets, local service ports, or
running containers unless those are explicitly provisioned in the sandbox
environment.

**Gate collection:** after cloud tasks complete, the orchestrator reads the
returned gate files and diff patches. If any gate is missing or FAIL, the
orchestrator re-dispatches that role's task with the failure context.

**Best for:** automated pipeline runs in CI, background processing of large
features, runs where human pairing is not required between stages.

---

## Parallelism in Stage 4 — Summary

| Profile | Parallelism | Wall-clock | Notes |
|---------|------------|------------|-------|
| `local` | Sequential | Sum of 3 workstreams | Simple; no merge step |
| `app_worktree` | True parallel (3 worktrees) | Max of 3 workstreams | Merge step required |
| `cloud` | True parallel (3 sandboxes) | Max of 3 workstreams | Fully self-contained prompts |

In all profiles, the orchestrator waits for all three Stage 4 gate files
before advancing to Stage 5. The gate file paths are identical regardless
of profile:

- `pipeline/gates/stage-04-backend.json`
- `pipeline/gates/stage-04-frontend.json`
- `pipeline/gates/stage-04-platform.json`

---

## Selecting a Profile

Set the default in `.codex/config.yml`:

```yaml
execution:
  default_profile: app_worktree
```

Override per-run with the `CODEX_TEAM_PROFILE` environment variable:

```bash
CODEX_TEAM_PROFILE=local npm run pipeline -- "Add password reset"
```

The profile does not affect gate semantics, artifact paths, or validation
rules — it only controls how the orchestrator dispatches role invocations.
