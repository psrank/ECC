---
name: review
description: Review the relevant implementation diff and report evidence-backed findings. Use only when the user explicitly invokes this manual ECC workflow stage.
---

# Manual Review Stage

Inspect the relevant diff, tests, and project instructions. Report findings by
severity with file references, concrete risk, and evidence. State explicitly
when no blocking findings are found.

Does not modify code unless the user separately asks for remediation. Do not
invoke, schedule, or autorun another stage.

## Next manual stage

For blocking findings, recommend `$ecc:implement`; otherwise recommend
`$ecc:verify`. The user chooses whether to invoke either stage.
