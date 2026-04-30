# Claude Dev Team Parity Checklist

Last updated: 2026-04-30

This checklist tracks whether `codex-dev-team` is on par with the local
`claude-dev-team` framework. Release notes remain deferred until v1.0.

## Summary

| Area | Status | Notes |
|---|---|---|
| Commands | On par | Claude slash commands have Codex npm/CLI equivalents. |
| Pipeline tracks | On par | full, quick, nano, config-only, dep-update, and hotfix are represented. |
| Gates | On par | JSON gates, schemas, track contracts, validation, and auto-fold helpers exist. |
| Roles | On par | PM, Principal, Backend, Frontend, Platform, QA, Reviewer, and Security prompts exist. |
| Deployment adapters | Better | Codex has explicit adapter docs for Docker Compose, Kubernetes, Terraform, and custom scripts. |
| Status/roadmap automation | Better | Codex has JSON status, next, and roadmap outputs. |
| Rules | Partial | Several Claude rule docs are not yet represented as dedicated Codex rules. |
| Skills | Partial | General implementation/review skills exist, but convention/security/rubric skills are not all ported. |

## Command Parity

| Claude command | Codex equivalent | Status |
|---|---|---|
| `/adr` | `npm run adr -- "<title>"` | Ported |
| `/ask-pm` | `npm run ask-pm` | Ported |
| `/audit` | `npm run audit -- "<scope>"` | Ported |
| `/audit-quick` | `npm run audit:quick -- "<scope>"` | Ported |
| `/config-only` | `npm run config-only -- "<change>"` | Ported |
| `/dep-update` | `npm run dep-update -- "<update>"` | Ported |
| `/design` | `npm run design -- "<feature>"` | Ported |
| `/health-check` | `npm run health-check` | Ported |
| `/hotfix` | `npm run hotfix -- "<bug and fix>"` | Ported |
| `/nano` | `npm run nano -- "<change>"` | Ported |
| `/pipeline` | `npm run pipeline -- "<feature>"` | Ported |
| `/pipeline-brief` | `npm run pipeline:brief -- "<feature>"` | Ported |
| `/pipeline-context` | `npm run pipeline:context` | Ported |
| `/pipeline-review` | `npm run pipeline:review` | Ported |
| `/principal-ruling` | `npm run principal-ruling -- "<question>"` | Ported |
| `/quick` | `npm run quick -- "<change>"` | Ported |
| `/reset` | `npm run reset` | Ported |
| `/resume` | `npm run resume -- <stage> "<reason>"` | Ported |
| `/retrospective` | `npm run retrospective` | Ported |
| `/review` | `npm run review:derive` and `pre-pr-review` skill | Ported |
| `/roadmap` | `npm run roadmap` | Ported |
| `/stage` | `npm run stage -- <name>` | Ported |
| `/status` | `npm run status` | Ported |

## Rule Parity

| Claude rule | Codex coverage | Status |
|---|---|---|
| `pipeline.md` | `.codex/rules/pipeline.md` | Ported |
| `gates.md` | `.codex/rules/gates.md` plus schemas | Ported |
| `coding-principles.md` | Partial through `AGENTS.md`, role prompts, and skills | Gap before v1.0 |
| `compaction.md` | Not represented as a dedicated Codex rule | Gap before v1.0 |
| `escalation.md` | Partial through `ESCALATE` gates, `principal-ruling`, and context signals | Gap before v1.0 |
| `orchestrator.md` | Partial through `scripts/codex-team.js` and `npm run next` | Gap before v1.0 |
| `retrospective.md` | Partial through retrospective stage and lessons helper | Gap before v1.0 |

## Skill Parity

| Claude skill | Codex coverage | Status |
|---|---|---|
| `implement` | `.codex/skills/implement/SKILL.md` | Ported |
| `pre-pr-review` | `.codex/skills/pre-pr-review/SKILL.md` | Ported |
| `api-conventions` | Role prompts and AGENTS coverage only | Gap before v1.0 |
| `code-conventions` | Role prompts and AGENTS coverage only | Gap before v1.0 |
| `review-rubric` | Reviewer role and pre-pr-review coverage only | Gap before v1.0 |
| `security-checklist` | Security role and `security:check` coverage only | Gap before v1.0 |

## Codex Improvements Beyond Claude

- npm/CLI shims work in non-Claude environments.
- Bootstrap installs into Node and non-Node projects without forcing package metadata.
- Status, roadmap, and next commands support JSON output for automation.
- Deployment adapters are documented and configured locally.
- Track-aware `next`, `prompt`, and `autofold` helpers reduce manual orchestration.
- Gate schemas and contract tests guard framework drift.

## v1.0 Blockers

- Port or replace dedicated rule docs for coding principles, compaction,
  escalation, orchestrator behavior, and retrospective behavior.
- Port or replace convention/rubric/security checklist skills.
- Add a final parity check that reports no `Gap before v1.0` rows.
