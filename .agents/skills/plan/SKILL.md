---
name: plan
description: Create an implementation-ready plan for a requested change. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Plan Stage

Inspect applicable `AGENTS.md` instructions and pending artifacts in
`spec-backlog/`, `docs/superpowers/specs/`, and `docs/superpowers/plans/`.
Treat missing folders as optional. Restate scope, identify risks and repository
patterns, then write or update a concrete plan and wait for approval.

Does not alter production code or start tests. Do not invoke, schedule, or
autorun another stage.

## Next manual stage

When the plan is approved, recommend `$ecc:test` to create and prove the RED
tests. The user chooses whether to invoke it.
