# Retrospective Rules

Stage 9 captures what nearly went wrong and promotes durable lessons into
future runs. It is not a blame exercise.

## Artifacts

| File | Lifetime | Purpose |
|---|---|---|
| `pipeline/retrospective.md` | Per run | Full record for the current feature |
| `pipeline/lessons-learned.md` | Persistent | Durable rules carried into future runs |

## Inputs

Collect these before synthesis:

- `pipeline/brief.md`
- `pipeline/design-spec.md`
- ADRs under `pipeline/adr/`
- `pipeline/context.md`
- `pipeline/pr-<area>.md`
- `pipeline/code-review/by-<area>.md`
- `pipeline/test-report.md`
- `pipeline/deploy-log.md`
- gates under `pipeline/gates/`

## Step 9a: Contributions

PM, Principal, Backend, Frontend, Platform, and QA each append one section to
`pipeline/retrospective.md`. Security contributes when the security gate fired.

Each section uses:

```markdown
## <role>
### What worked
- ...

### What I got wrong and how I noticed
- ...

### Where the pipeline slowed me down
- ...

### One lesson worth carrying forward
- **Rule:** ...
  **Why:** ...
  **How to apply:** ...
```

Agents read existing sections first and avoid duplicate lessons. If there is no
new lesson, they name the strongest existing lesson reinforced by the run.

## Step 9b: Synthesis

The Principal appends a dated synthesis block and updates
`pipeline/lessons-learned.md`.

Promote at most two lessons per run. A promoted lesson must be concrete,
repeatable, and useful beyond the current feature. Retire lessons that are
wrong, fully internalized, or stale for 10 runs without reinforcement.

Each durable lesson uses:

```markdown
### L001 - Short title
**Added:** YYYY-MM-DD (run: feature)
**Reinforced:** 0
**Rule:** One sentence.
**Why:** Why this matters.
**How to apply:** Where to use it.
```

When reinforced, use:

```markdown
**Reinforced:** 2 (last: YYYY-MM-DD)
```

Write `pipeline/gates/stage-09.json` with status `PASS`,
`lessons_promoted`, and `lessons_retired` unless synthesis itself fails.

## Severity

- green: no escalations, retries, or post-build blockers.
- yellow: retry, post-build blocker, or resolved escalation.
- red: shipped defect, bypassed gate, failed deploy, or unresolved halt.

## Outside Stage 9

Run a retrospective after any unresolved red halt and after hotfixes. Hotfix
retrospectives may use a single abbreviated section.
