---
name: hotfix
description: "Run an expedited fix path for urgent production bugs while preserving gates, tests, and retrospective notes."
---

# Hotfix Skill

Use only for urgent defects.

Required outputs:

- bug summary in `pipeline/context.md`
- fix diff
- regression test or explicit reason none is possible
- hotfix gate with `track: hotfix`
- rollback note

Hotfixes still require verification. If the same failure recurs after one
retry, escalate to the Principal role instead of continuing to patch.
