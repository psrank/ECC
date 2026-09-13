# Codex Core Workflow Skills Design

## Purpose

Expose ECC's manual development lifecycle as seven clearly named Codex skills:

```text
$ecc:plan -> $ecc:test -> $ecc:implement -> $ecc:review -> $ecc:verify -> $ecc:remember -> $ecc:improve
```

The sequence is human-directed. Invoking a stage must not invoke, schedule, or
autorun the next one.

## Scope

Add seven canonical skills under `skills/`: `plan`, `test`, `implement`,
`review`, `verify`, `remember`, and `improve`. Add matching Codex-facing
copies and `agents/openai.yaml` metadata under `.agents/skills/`.

The ECC native-plugin namespace supplies the `ecc:` prefix at install time.
The source skill names therefore stay bare and kebab-case; no global rename is
needed. Existing skills, legacy `commands/`, and Claude Code `/ecc:*` command
compatibility remain unchanged.

## Stage Contracts

| Skill | Outcome | Boundary |
|---|---|---|
| `plan` | An implementation-ready plan grounded in repository conventions and pending planning artifacts. | Does not alter production code or start tests. |
| `test` | Focused tests and recorded RED evidence for an approved plan. | Does not modify production code. |
| `implement` | Safely reuses or creates a feature branch, then makes minimal production changes that satisfy the approved plan and RED tests. | Does not review, verify broadly, capture memory, or pull, push, commit, or change Git configuration. |
| `review` | Evidence-backed review findings for the relevant diff. | Does not modify code unless the user separately asks for remediation. |
| `verify` | A repository-native build, lint, type, test, coverage, security, and diff report. | Does not claim readiness when a required check fails or cannot run. |
| `remember` | A durable, concise ECC Memory Vault context or handoff when the runtime is available. | Does not store secrets, replace project documentation, or run automatically. |
| `improve` | Evidence-based process or workflow improvement proposals after the task. | Does not change skills, commands, rules, or code without explicit approval. |

## Reuse

The skills are thin stage-specific entry points. They reference existing ECC
guidance rather than copying full workflows:

- `tdd-workflow` supplies the TDD safeguards for `test` and `implement`.
- `git-workflow` supplies the safe feature-branch conventions for `implement`.
- `verification-loop` supplies the verification gates for `verify`.
- `unified-memory` supplies vault prerequisites and trust boundaries for
  `remember`.
- Existing project instructions supply the planning-artifact locations and the
  no-autorun rule.

`review` and `improve` remain self-contained where no precise existing skill
matches their manual-stage boundary.

## Invocation Policy

The Codex-facing metadata marks all seven as explicit-only. They appear under
the ECC plugin namespace for direct use but are not selected implicitly. This
matches the requested non-autorun workflow while leaving the existing ECC
skills' current discovery behaviour intact.

## Manual Handoff Recommendations

Every core stage ends with a `Next manual stage` section. It recommends a
typed `$ecc:` invocation but never calls that skill itself.

| Current stage | Recommendation |
|---|---|
| `plan` | After approval, use `$ecc:test`. |
| `test` | After valid RED evidence, use `$ecc:implement`. |
| `implement` | After targeted GREEN evidence, use `$ecc:review`. |
| `review` | Use `$ecc:implement` for blocking findings; otherwise use `$ecc:verify`. |
| `verify` | Use `$ecc:remember` when ready; otherwise return to `$ecc:test`, `$ecc:implement`, or `$ecc:review` based on the missing evidence. |
| `remember` | Use `$ecc:improve` after saving or intentionally declining a memory. |
| `improve` | Use `$ecc:plan` only for an approved follow-up; otherwise end the workflow. |

The handoff is advisory rather than enforcement: it must say that the user
chooses whether to invoke the recommended stage.

## Implementation Branch Handoff

Before production edits, `$ecc:implement` inspects the repository, worktree,
current branch, default branch, and working-tree status. It uses an existing
non-default feature branch only when it clearly belongs to the approved plan,
including a matching feature worktree. From a clean default branch, it creates
and switches to `feat/<plan-slug>`, where the slug is derived from the approved
plan.

For a dirty default-branch worktree, detached `HEAD`, an indeterminate default
branch, or an ambiguous existing branch name, the stage explains the blocker
and waits for user direction. Non-Git directories proceed without branch
creation. This is explicit stage behavior, not a hook: the handoff never pulls,
pushes, commits, or changes Git configuration.

## Validation

Add focused structural tests covering the seven source skills, their matching
Codex copies, exact frontmatter names, explicit-only metadata, and their
stage-boundary statements. Run the targeted test, the Codex skill-surface test,
and the repository skill validators that are available locally.

## Out of Scope

- Renaming all 292 skills or all 94 legacy commands.
- Adding native Codex slash commands.
- Automatic progression, timers, background loops, or task-state automation.
- Changing the existing local-plugin launcher.
