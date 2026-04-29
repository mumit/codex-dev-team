---
name: quick
description: "Run a lightweight Codex Dev Team path for small, contained code changes."
---

# Quick Skill

Use for small changes that touch one area and have low architectural risk.

1. Write a short brief in `pipeline/context.md`.
2. Implement the change.
3. Run targeted tests and lint.
4. Write a gate with `track: quick`.
5. Summarize PR readiness.

Use a full pipeline instead if the change touches more than one ownership
area, changes architecture, introduces new dependencies, or needs a security
decision.
