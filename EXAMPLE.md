# Example Pipeline Run

This document walks through a complete pipeline run for a real feature so
you know exactly what to expect at each stage.

**Feature**: "Add password reset via email"

---

## Starting the Pipeline

```
npm run pipeline -- "Add password reset via email"
```

The orchestrator reads `AGENTS.md`, then `.codex/rules/pipeline.md`, then
`pipeline/context.md` (empty on a fresh run), then invokes the first role.

---

## Stage 1 — Requirements (PM)

**Role invoked**: `pm`
**Input**: "Add password reset via email"

The PM role writes `pipeline/brief.md`:

```markdown
# Feature Brief: Password Reset via Email

## Problem Statement
Users who forget their password have no self-service recovery path.
They must contact support, creating friction and support load.

## User Stories
1. As a user who forgot my password, I want to request a reset link
   via email so that I can regain access without contacting support.
2. As a user, I want the reset link to expire after 1 hour so that
   my account remains secure.
3. As a user, I want to be shown a success message even if my email
   isn't registered, so that account existence isn't leaked.

## Acceptance Criteria
1. POST /auth/password-reset accepts an email address and always returns 200
2. If the email is registered, a reset email is sent within 5 seconds
3. The reset link contains a signed token, expires in 1 hour
4. GET /auth/password-reset/:token validates the token and renders a reset form
5. POST /auth/password-reset/:token accepts new password, invalidates token
6. Passwords must be minimum 8 characters
7. Used or expired tokens return a clear error, not a 500

## Out of Scope
- SMS reset
- Social login recovery
- Admin-initiated password reset

## Open Questions
None at this time.
```

The PM writes `pipeline/gates/stage-01.json`:
```json
{
  "stage": "stage-01",
  "status": "PASS",
  "agent": "pm",
  "track": "full",
  "timestamp": "2026-03-26T10:00:00Z",
  "acceptance_criteria_count": 7,
  "out_of_scope_items": ["SMS reset", "Social login recovery"],
  "required_sections_complete": true,
  "blockers": [],
  "warnings": []
}
```

The gate-validator hook fires, exits 0.

---

### Checkpoint A

```
================================================================
  Checkpoint A — Requirements complete

The PM has written a brief with 7 acceptance criteria covering the full
password reset flow: request, email delivery, token validation, password
update, and security constraints. Out of scope: SMS and social login.

Review pipeline/brief.md if you'd like to adjust anything before design starts.

Run: npm run next
================================================================
```

You type: `proceed` (or `npm run next` advances automatically if
`checkpoints.a.auto_pass_when: no_warnings` is set and warnings is empty).

---

## Stage 2 — Design

### Step 2a: Principal drafts

**Role invoked**: `principal`
**Input**: `pipeline/brief.md`

The Principal writes `pipeline/design-spec.md` (STATUS: DRAFT) covering:
- System design: new `password_reset_tokens` table, email service integration
- API contracts: exact request/response shapes for all 3 endpoints
- Token design: HMAC-signed, stored hash only (not plaintext)
- Component ownership: backend owns all endpoints + token logic, platform owns email service infra
- Security: constant-time token comparison, rate limiting on POST /auth/password-reset

### Step 2b: Dev annotations (parallel)

All three dev roles are invoked in parallel (read-only). They append to
`pipeline/design-review-notes.md`:

```markdown
## dev-backend notes
- The spec doesn't mention rate limiting implementation — suggest express-rate-limit
  or a Redis-backed solution. QUESTION: do we have Redis in the stack? @PM

## dev-frontend notes
- The reset form needs a loading state spec — what do we show while the
  POST is in flight? Added as a concern for Principal to address.

## dev-platform notes
- The spec says "email sent within 5 seconds" — this implies synchronous send
  in the request path. For reliability this should be a queue.
  Flagging as architectural concern.
```

### Step 2c: Principal chairs review

The Principal reads the annotations. Addresses each:
- **Redis question** → writes `QUESTION: Do we have Redis in the stack? @PM` to
  `pipeline/context.md`. Implements with in-memory rate limiting for now, notes
  it as a known limitation in the ADR.
- **Loading state** → adds loading state spec to design-spec.md
- **Email queue** → accepts the platform dev's concern. Updates spec to use a
  queue. Writes ADR:

`pipeline/adr/0001-email-delivery-via-queue.md`:
```markdown
# 0001 — Email Delivery via Queue

**Status**: Accepted
**Date**: 2026-03-26

## Context
The brief requires email sent within 5 seconds. Synchronous send in the
request path risks timeouts and makes the API brittle on email provider failures.

## Decision
Send reset emails via an async job queue (BullMQ or equivalent).
The API returns 200 immediately; delivery happens within 5 seconds target.

## Rationale
- Decouples API reliability from email provider reliability
- Enables retry on delivery failure
- Direct synchronous send rejected: timeout risk, no retry

## Consequences
Platform dev must provision queue infrastructure. Adds complexity to local dev setup.
```

Principal updates `pipeline/design-spec.md` to APPROVED status.
PM is invoked to confirm scope fit → PM writes `"pm_approved": true` to stage-02 gate.

`pipeline/gates/stage-02.json`:
```json
{
  "stage": "stage-02",
  "status": "PASS",
  "agent": "principal",
  "track": "full",
  "timestamp": "2026-03-26T10:45:00Z",
  "arch_approved": true,
  "pm_approved": true,
  "adr_count": 1,
  "blockers": [],
  "warnings": ["Redis not confirmed — rate limiting uses in-memory for now"]
}
```

---

### Checkpoint B

```
================================================================
  Checkpoint B — Design complete

The Principal has approved a design covering 3 API endpoints, a signed
token system, and async email delivery via queue. One ADR written
(email-via-queue). One warning: Redis not confirmed — rate limiting is
in-memory for now. One open PM question about Redis is logged.

Review pipeline/design-spec.md and pipeline/adr/ before build starts.

Run: npm run next
================================================================
```

You type: `proceed`

---

## Stage 3 — Pre-Build Clarification

Orchestrator checks `pipeline/context.md` for open questions.
Finds: `QUESTION: Do we have Redis in the stack? @PM`
Invokes PM role to answer it.

PM checks the project setup (reads `src/` structure, package.json).
Finds Redis is not in the stack.

PM appends to `pipeline/context.md`:
```
QUESTION: Do we have Redis in the stack? @PM
PM-ANSWER: No Redis. Use in-memory rate limiting. Note this as a
production limitation in deploy-log.md.
```

No brief change needed. Pipeline proceeds immediately.

---

## Stage 4 — Build (parallel workstreams)

Three build workstreams fan out in parallel. In `app_worktree` profile:

```bash
# Codex app creates isolated worktrees:
# feature/build-backend   → dev-backend role
# feature/build-frontend  → dev-frontend role
# feature/build-platform  → dev-platform role
```

In `local` profile, the same roles run sequentially in the current checkout.
See `.codex/rules/execution-profiles.md` for the full comparison.

**dev-backend** builds:
- `src/backend/routes/auth.js` — 3 endpoints
- `src/backend/services/tokenService.js` — HMAC token generation/validation
- `src/backend/models/passwordResetToken.js` — DB model
- Writes `pipeline/pr-backend.md` + `pipeline/gates/stage-04-backend.json`

**dev-frontend** builds:
- `src/frontend/pages/ForgotPassword.jsx`
- `src/frontend/pages/ResetPassword.jsx`
- Writes `pipeline/pr-frontend.md` + `pipeline/gates/stage-04-frontend.json`

**dev-platform** builds:
- `src/infra/queue/emailQueue.js` — BullMQ job queue
- `src/infra/email/resetEmailTemplate.js` — email template
- `.github/workflows/ci.yml` — CI pipeline update
- Writes `pipeline/pr-platform.md` + `pipeline/gates/stage-04-platform.json`

---

## Stage 5 — Pre-review checks

`dev-platform` runs lint, type-check, and SCA. All pass. The security
heuristic fires because `src/backend/auth.js` matches the `src/backend/auth*`
trigger path.

`security` role invoked → reviews the token handling and rate-limit implementation.

`pipeline/gates/stage-05.json`:
```json
{
  "stage": "stage-05",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "2026-03-26T11:10:00Z",
  "lint_passed": true,
  "tests_passed": true,
  "dependency_review_passed": true,
  "security_review_required": true,
  "blockers": [],
  "warnings": []
}
```

`pipeline/gates/stage-05-security.json`:
```json
{
  "stage": "stage-05-security",
  "status": "PASS",
  "agent": "security",
  "track": "full",
  "timestamp": "2026-03-26T11:15:00Z",
  "security_approved": true,
  "veto": false,
  "triggering_conditions": ["path:auth"],
  "blockers": [],
  "warnings": ["In-memory rate limiter not cluster-safe — Redis recommended for production"]
}
```

---

## Stage 6 — Peer Code Review

The diff crosses backend, frontend, and infra — matrix review shape selected.

Review matrix:
- `dev-backend` reviews: frontend + platform PRs
- `dev-frontend` reviews: backend + platform PRs
- `dev-platform` reviews: backend + frontend PRs

Each reviewer reads the brief, design spec, ADRs, then the changed files.

**An escalation occurs**: `dev-frontend`, reviewing `pr-backend.md`, finds
that the token endpoint returns the raw token in the response body (for the
reset email link). This contradicts the design spec which says "stored hash
only". Frontend dev writes in `pipeline/code-review/by-frontend.md`:

```markdown
## Review of backend

The POST /auth/password-reset/:token endpoint returns the raw token in
the response body. The design spec (section 3.2) says only hashes are stored.
Either the spec is wrong or the implementation is wrong.

REVIEW: CHANGES REQUESTED
BLOCKER: Token handling contradiction between spec and implementation.
Need Principal ruling before this can proceed.
```

The `approval-derivation.js` hook fires, updates `pipeline/gates/stage-06-backend.json`
with `changes_requested`. Gate status flips to FAIL. Gate-validator detects
ESCALATE. Orchestrator surfaces to user:

```
Escalation — Stage 6 (Peer Review)

Reason: Token handling contradiction between spec and implementation.
Decision needed: Should the reset link embed the raw token (implementation)
or should the email be sent server-side with no token in response (spec)?

Options:
  A — Email sent server-side. Token never leaves the backend. (spec intent)
  B — Return raw token in response, frontend constructs the link. (implementation)
```

You type: `A — email sent server-side`

Orchestrator records in `pipeline/context.md`:
```
## User Decisions
2026-03-26T11:30:00Z — Stage 6 escalation resolved:
Email sent server-side. Token never returned in API response.
Backend must be updated accordingly.
```

`npm run principal-ruling -- "token-not-in-response"` invoked. Principal
updates the design spec, writes `pipeline/adr/0002-token-not-in-response.md`,
routes the fix back to `dev-backend`. Backend dev fixes the endpoint,
re-submits PR.

Code review resumes. All three PRs get 2 approvals each. The
`approval-derivation.js` hook reconciles all three area gates to PASS.

---

## Stage 7 — QA

`dev-qa` role invoked. Writes and runs tests for all 7 acceptance criteria.

One test initially fails:
```
FAIL: src/tests/auth.test.js
  ✕ returns 200 for unregistered email (constant time)
    Expected status 200, received 404
```

Gate assigns fix to `dev-backend`. Backend dev fixes the route (missing
wildcard handling). QA re-runs tests. All 7 pass.

`pipeline/gates/stage-07.json`:
```json
{
  "stage": "stage-07",
  "status": "PASS",
  "agent": "qa",
  "track": "full",
  "timestamp": "2026-03-26T12:00:00Z",
  "all_acceptance_criteria_met": true,
  "tests_total": 23,
  "tests_passed": 23,
  "tests_failed": 0,
  "failing_tests": [],
  "assigned_retry_to": null,
  "criterion_to_test_mapping_is_one_to_one": true,
  "blockers": [],
  "warnings": []
}
```

---

### Checkpoint C

```
================================================================
  Checkpoint C — All tests pass

23/23 tests pass. All 7 acceptance criteria verified. One fix was needed
(404 for unregistered email) and was resolved before this checkpoint.

Review pipeline/test-report.md against pipeline/brief.md if you'd like
to verify coverage before deploy.

Run: npm run next
================================================================
```

Because `checkpoints.c.auto_pass_when` is null (default), the pipeline waits.
You type: `proceed`

If `auto_pass_when: all_criteria_passed` were configured, the orchestrator
would have written to `pipeline/context.md`:

```
2026-03-26T12:00:00Z — CHECKPOINT-AUTO-PASS: c (all_criteria_passed)
```

and advanced automatically.

---

## Stage 8 — Sign-off and Deploy

Because Stage 7 has `all_acceptance_criteria_met: true` and
`criterion_to_test_mapping_is_one_to_one: true`, the orchestrator writes the
PM sign-off auto-fold without invoking the PM:

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "orchestrator",
  "track": "full",
  "timestamp": "2026-03-26T12:05:00Z",
  "pm_signoff": true,
  "deploy_requested": false,
  "runbook_referenced": false,
  "auto_from_stage_07": true,
  "blockers": [],
  "warnings": ["Deployment not requested by auto-fold"]
}
```

`dev-platform` then provisions the deployment using the `docker-compose`
adapter (`.codex/adapters/docker-compose.md`). Runs smoke tests.

Final gate:
```json
{
  "stage": "stage-08",
  "status": "PASS",
  "agent": "platform",
  "track": "full",
  "timestamp": "2026-03-26T12:10:00Z",
  "adapter": "docker-compose",
  "environment": "production",
  "pm_signoff": true,
  "smoke_test_passed": true,
  "runbook_referenced": true,
  "adapter_result": { "compose_up_exit": 0, "services_healthy": ["api", "worker"] },
  "blockers": [],
  "warnings": ["Rate limiting is in-memory — production should use Redis"]
}
```

PM writes stakeholder summary to `pipeline/deploy-log.md`:
> Password reset via email is now live. Users can request a reset link
> from the login page. Links expire after 1 hour. Note: rate limiting
> uses in-memory storage and should be migrated to Redis before high
> traffic events.

---

## Stage 9 — Retrospective

All roles (pm, principal, dev-backend, dev-frontend, dev-platform, dev-qa,
security) contribute sections to `pipeline/retrospective.md` in parallel.
Principal synthesizes, promotes one lesson to `pipeline/lessons-learned.md`:

```
L001 — Spec-to-implementation review shape: when a spec says "store hash only"
and the implementation returns a raw value, the contradiction only surfaces at
peer review if a reviewer from a different area checks that specific endpoint.
Cross-area matrix review is the safeguard. Reinforced: 1 (last: 2026-03-26)
```

Gate `pipeline/gates/stage-09.json` written with `status: PASS`.

---

## Final Pipeline Status

```
npm run status

Pipeline Status — Password Reset via Email
================================================================
Stage                          Status    Role          Notes
----------------------------------------------------------------
01 Requirements                PASS      pm            7 criteria
02 Design                      PASS      principal     2 ADRs
03 Clarification               PASS      pm            Redis: use in-memory
04a Build (backend)            PASS      dev-backend
04b Build (frontend)           PASS      dev-frontend
04c Build (platform)           PASS      dev-platform
05a Pre-review                 PASS      platform
05b Security review            PASS      security      path:auth triggered
06a Peer Review (backend)      PASS      codex-team    1 escalation resolved
06b Peer Review (frontend)     PASS      codex-team
06c Peer Review (platform)     PASS      codex-team
07  QA                         PASS      qa            23/23 pass
08  Sign-off + Deploy          PASS      platform      smoke tests pass
09  Retrospective              PASS      principal     1 lesson promoted
----------------------------------------------------------------
1 warning: Rate limiting in-memory — migrate to Redis before scale
```

---

## What the Example Illustrates

**The PM question in Stage 3** — a real ambiguity (Redis availability) was
caught before build started, not discovered mid-implementation.

**The escalation in Stage 6** — a contradiction between spec and code was
caught by a peer reviewer, not the author. The peer review cross-pollination
(frontend dev reading backend code) found something the backend dev wouldn't
self-catch.

**The test failure loop in Stage 7** — the gate correctly identified which
dev owned the failing test and routed the fix precisely. No retry storm.

**The warning propagation** — the Redis limitation surfaced in Stage 2 was
carried through gates as a warning all the way to the deploy log, so it
appears in the stakeholder summary and isn't silently forgotten.

**The security trigger** — touching `src/backend/auth.js` automatically
fired the Stage 5b security review heuristic. No manual routing needed.

**Budget tracking** — if `budget.enabled: true` were set in `.codex/config.yml`,
`pipeline/budget.md` would have been written at Stage 0 and updated at each
stage boundary. After Stage 7, `npm run budget -- check` would compare the
running token total to `tokens_max` and either escalate or warn.

**Pipeline visualization** — `npm run visualize` writes `pipeline/diagram.md`
with a Mermaid stateDiagram showing each stage colored by gate status (green
for PASS, red for FAIL, orange for ESCALATE, gray for not-yet-run).
