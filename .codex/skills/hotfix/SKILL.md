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
