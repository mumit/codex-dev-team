# Execution Profiles

## Local

Use when the user is actively pairing in a terminal, IDE, or Codex app thread.
Keep updates concise and run verification locally.

## App Worktree

Use for parallel tasks in isolated worktrees. Each task must own a disjoint
write scope and return changed files plus verification results.

## Cloud

Use for delegated background tasks. Prompts must include all context needed to
complete the task because cloud tasks should not rely on the current chat
thread. Ask for a branch-ready diff and a summary of tests run.
