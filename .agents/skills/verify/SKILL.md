---
name: verify
description: Run repository-native quality checks and report readiness. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Verify Stage

Use `verification-loop` to select the repository's build, type, lint, test,
coverage, security, and diff checks. Report every command and its result,
distinguishing failed, unavailable, and unrun checks. Do not claim readiness
while a required check lacks passing evidence.

Does not repair failures automatically. Do not invoke, schedule, or autorun
another stage.

## Next manual stage

When all required evidence passes, recommend `$ecc:remember`. For a missing
test, implementation, or review-evidence gap, recommend `$ecc:test`,
`$ecc:implement`, or `$ecc:review` respectively. The user chooses whether to invoke the recommended stage.
