---
name: implement
description: Implement the approved plan minimally after RED tests exist. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Implement Stage

Read the approved plan and focused RED tests. Make the smallest production
change that satisfies the specified behavior, then rerun the relevant tests and
record GREEN evidence. Preserve repository conventions and do not broaden scope.

## Branch handoff

Before modifying production code, inspect the Git repository and current worktree.
If the directory is not a Git repository, state that no branch was created and
continue without Git operations. Otherwise, identify the current branch, its
default branch, and whether the working tree is clean.

- On an existing non-default feature branch that clearly belongs to the approved
  plan, including a worktree already dedicated to the plan, use the current branch.
- When on a clean default branch, create and switch to `feat/<plan-slug>` before modifying production code.
  Derive `<plan-slug>` from the approved plan's filename or title, using a
  concise lowercase kebab-case name. Before creating it, check for an existing
  branch of that name; reuse it only when it clearly belongs to the same plan,
  otherwise ask the user to choose a name.
- When the default branch worktree is dirty, `HEAD` is detached, or the default branch cannot be determined, do not create or switch branches; explain the blocker and wait for user direction.

Do not pull, push, commit, or modify Git configuration as part of this handoff.

Does not review, verify broadly, or capture memory. Do not invoke, schedule, or
autorun another stage.

## Next manual stage

After targeted GREEN evidence, recommend `$ecc:review` for an evidence-backed
diff review. The user chooses whether to invoke it.
