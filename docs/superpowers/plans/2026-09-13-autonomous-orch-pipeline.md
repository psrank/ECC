# Autonomous Orchestrator Pipeline Implementation Plan

**Goal:** Add an explicit, opt-in ECC skill that autonomously drives one
approved plan item through planning, TDD, review, verification, safe memory
capture, and an improvement proposal, while preserving the seven manual stages
as explicit-only workflows.

**Architecture:** Implement a new `autonomous-orch-pipeline` skill on the
canonical `skills/` surface and mirror it exactly under `.agents/skills/` for
Codex. It reuses `orch-pipeline`, `verification-loop`, and `unified-memory` as
guidance rather than reimplementing them. The skill owns a local,
Git-ignored `.ecc/autonomous-runs/<run-id>.md` ledger and its bounded
state-machine contract. A Node structural test locks that contract down.

**Tech stack:** Markdown skills, YAML skill metadata, Node.js built-in
assertions, the existing ECC catalog and skill validators.

## Confirmed Decisions

- Build on `orch-pipeline`, not the external `ccg-workflow`-dependent
  `/workflow` command.
- Keep the new workflow explicit-only at invocation time. Autonomy begins only
  after a plan approval gate.
- Require approval before committing and never push automatically.
- Permit three automatic failed review/remediation rounds. A fourth requires
  explicit approval for exactly one additional round; the limit never expands
  silently.
- Preserve all seven manual core-stage skill contracts and metadata unchanged.
- Keep `improve` proposal-only and treat unavailable safe Memory Vault writes
  as visible `memory-pending`, not a reason to bypass the Vault safeguards.
- Do not add a legacy slash-command shim in this release.

## Worktree Constraint

The working tree already has unrelated, uncommitted manual-core workflow and
catalog changes. Integrate with those changes; do not revert, stage, or commit
them. In particular, generate catalog updates only after reviewing their diff
alongside the existing count changes.

## Task 1 — Lock the autonomous workflow contract with a failing test

**Files:**

- Create: `tests/ci/autonomous-orch-pipeline.test.js`

**Interfaces:**

- Consumes the canonical and Codex-mirror skill files, their metadata,
  `package.json`, `manifests/install-modules.json`, and `.gitignore`.
- Produces a dependency-free Node contract test that reports assertion totals
  and fails before the new skill exists.

1. Define the expected canonical and mirror locations:

   ```js
   const SKILL = 'autonomous-orch-pipeline';
   const CANONICAL = path.join(REPO_ROOT, 'skills', SKILL);
   const MIRROR = path.join(REPO_ROOT, '.agents', 'skills', SKILL);
   ```

2. Assert that each surface has `SKILL.md` and `agents/openai.yaml`, and that
   the corresponding canonical and mirrored files are byte-for-byte equal.
3. Assert that skill frontmatter uses the folder name, has an inline
   description, and that metadata has a complete
   `$ecc:autonomous-orch-pipeline` default prompt plus
   `policy.allow_implicit_invocation: false`.
4. Assert the behavior contract is present in `SKILL.md`:

   - lifecycle order `plan -> test -> implement -> review -> verify ->
     remember -> improve`;
   - an approval gate before production edits and a separate approval gate
     before commit;
   - no automatic push or external publishing;
   - a `.ecc/autonomous-runs/<run-id>.md` ledger with no raw transcripts or
     secrets;
   - three failed review/remediation rounds as the default, followed by
     `needs_user_approval` and authorization for exactly one more round;
   - verification-failure recovery and the two-checkpoint no-progress stop;
   - `completed`, `completed-with-memory-pending`, and `blocked` terminal
     semantics;
   - `improve` is proposal-only without separately approved workflow edits;
   - an explicit statement that the seven manual stage skills are preserved
     and are not auto-invoked.

5. Assert `package.json` includes `skills/autonomous-orch-pipeline/`, the
   `agentic-patterns` install module includes
   `skills/autonomous-orch-pipeline`, and `.gitignore` includes
   `/.ecc/autonomous-runs/` so local run records never become accidental
   repository content.
6. Run the test to prove RED:

   ```bash
   rtk node tests/ci/autonomous-orch-pipeline.test.js
   ```

   Expected: non-zero exit identifying the missing canonical skill surface.

## Task 2 — Create the canonical autonomous pipeline and Codex mirror

**Files:**

- Create: `skills/autonomous-orch-pipeline/SKILL.md`
- Create: `skills/autonomous-orch-pipeline/agents/openai.yaml`
- Create: `.agents/skills/autonomous-orch-pipeline/SKILL.md`
- Create: `.agents/skills/autonomous-orch-pipeline/agents/openai.yaml`
- Test: `tests/ci/autonomous-orch-pipeline.test.js`

**Interfaces:**

- Input: a `@plan-path#item-id` reference or an unplanned plain-language
  request.
- Output: an approved-item run ledger, phase evidence, an explicit approval
  request when required, and a terminal status.

1. Add skill frontmatter named `autonomous-orch-pipeline` with a concise
   description that makes its explicit invocation and autonomous
   post-approval behavior clear.
2. Define invocation semantics:

   - With a plan item reference, validate the referenced item has objective,
     scope boundary, and verifiable acceptance criteria.
   - With a plain request, perform intake and planning, write a task list, and
     stop at the plan gate.
   - Never start code changes without the plan approval recorded in the ledger.
3. Define the Markdown run-ledger format at
   `.ecc/autonomous-runs/<run-id>.md`. Include stable run ID, source item,
   acceptance criteria, repository/worktree/branch/plan fingerprint and
   baseline-commit compatibility fields, active stage, last completed
   checkpoint, next action, transition history, command evidence, review
   count/findings, memory status, improvement proposal, and final status.
   Explicitly prohibit secrets and raw transcripts.
4. Before new-request intake, discover non-terminal ledgers. Resume exactly
   one ledger compatible with the supplied plan item, or the sole unfinished
   ledger when no input is supplied. Require matching repository, canonical
   worktree, branch, plan fingerprint, and baseline-commit fields; a mismatch
   stops for re-approval or an explicit new run. Report its checkpoint and
   pending gate; let the user choose among multiple candidates. Treat
   `needs_user_approval` and `blocked` as paused/resumable states, not final
   outcomes. Never infer an owned run solely from a plan file, task checkbox,
   worktree, branch, or conversation. Checkpoint before each stage and advance
   only after its evidence is recorded, so interruption repeats the incomplete
   stage safely.
5. Resolve and report `Current stage`, last completed checkpoint, evidence
   basis, and next action before autonomous work. Prefer explicit ledger fields;
   otherwise derive only from ordered durable evidence. In particular, a
   blocking review finding without later GREEN takes precedence and maps to
   `implement (review remediation)`. Missing or contradictory evidence maps to
   `needs_user_approval`, never a guessed stage.
6. Implement the autonomous phase rules in the skill text:

   - create focused RED evidence, then make the smallest GREEN change;
   - route only behavior-related RED failures to implementation and escalate
     unrelated baseline failures;
   - obtain a fresh-context review after each change;
   - return blocking findings to the narrow responsible implementation task;
   - after three failed review/remediation rounds, set
     `needs_user_approval`, show the consolidated evidence, and ask for one
     additional round at a time;
   - run repository-native verification through `verification-loop`; route a
     failing check to its responsible stage, then repeat review if code
     changed;
   - freeze after the same verification failure makes no measurable progress
     across two repair checkpoints;
   - request approval before conventional commit and never push.
7. Define the final stages:

   - use `unified-memory` to search before saving a concise, non-secret,
     evidence-backed outcome; do not initialize, weaken, or bypass the Vault;
   - record `memory-pending` and report it if the optional runtime is missing
     or rejects the save;
   - create the smallest evidence-based improvement proposal, but do not edit
     workflow artifacts without separate approval.
8. Define completion states exactly as the approved design: `completed`,
   `completed-with-memory-pending`, `needs_user_approval`, and `blocked`.
   A failed required verification, unresolved blocking finding, or declined
   gate must not be reported as completed.
9. Reference `orch-pipeline`, `verification-loop`, and `unified-memory`
   instead of duplicating their detailed checklists. State directly that the
   manual `$ecc:plan` through `$ecc:improve` skills remain explicit-only and
   are never invoked automatically by this skill.
10. Add identical `openai.yaml` metadata on both surfaces. Use a 25–64
   character short description, a default prompt naming only
   `$ecc:autonomous-orch-pipeline`, and
   `allow_implicit_invocation: false`.
11. Copy the canonical files to the Codex mirror without divergence and run:

   ```bash
   rtk node tests/ci/autonomous-orch-pipeline.test.js
   ```

   Expected: GREEN.

## Task 3 — Package the skill, protect runtime state, and update discovery

**Files:**

- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `manifests/install-modules.json`
- Modify: `.codex/AGENTS.md`
- Modify generated catalog documents reported by `scripts/ci/catalog.js`
- Modify: `.codex-plugin/plugin.json`
- Test: `tests/ci/autonomous-orch-pipeline.test.js`

1. Add `/.ecc/autonomous-runs/` to `.gitignore`. Do not ignore
   `.ecc/memory/`; its existing Memory Vault safeguards remain authoritative.
2. Add `skills/autonomous-orch-pipeline/` adjacent to the existing `orch-*`
   package entries and add `skills/autonomous-orch-pipeline` to the
   `agentic-patterns` install module. The package already ships `.agents/`, so
   do not add a duplicate package rule for the mirror.
3. Reconcile the existing uncommitted manual core-stage package entries by
   adding their canonical paths to the `workflow-quality` install module. This
   preserves the package-surface invariant that every curated packaged skill
   has an install-module owner.
4. Add a short **Autonomous Workflow** entry to `.codex/AGENTS.md` that
   documents `$ecc:autonomous-orch-pipeline`, the plan and commit gates, and
   its bounded review escalation. Keep the Manual Core Workflow table intact.
5. Run the catalog synchronizer after the skill exists:

   ```bash
   rtk npm run catalog:sync
   ```

   Review every generated count update; with the new skill, counts should move
   from 299 to 300 while preserving unrelated current changes. Retain only the
   catalog-owned updates in `README.md`, `AGENTS.md`, Chinese catalog docs, and
   Claude plugin metadata.
6. Update the two Codex-plugin descriptions in `.codex-plugin/plugin.json`
   from 299 to 300 skills; `scripts/ci/catalog.js` does not manage that file.
7. Confirm the package, install-module, and ignore assertions in the focused
   contract test pass.

## Task 4 — Run delivery checks and review scope

**Files:**

- Test: all files above

1. Run the focused and adjacent structural tests:

   ```bash
   rtk node tests/ci/autonomous-orch-pipeline.test.js
   rtk node tests/ci/codex-core-workflow-skills.test.js
   rtk node tests/ci/codex-skill-surface.test.js
   rtk node tests/ci/catalog.test.js
   ```

2. Validate the canonical skill and catalog:

   ```bash
   rtk node scripts/ci/validate-skills.js --strict
   rtk npm run catalog:check
   ```

3. Run the repository test suite and coverage command when dependencies are
   available. If an environment prerequisite is absent, record it as an
   environment blocker rather than weakening a test or changing the workflow
   contract.

4. Inspect scope and whitespace without staging or committing unrelated work:

   ```bash
   rtk git diff --check
   rtk git diff -- skills/autonomous-orch-pipeline .agents/skills/autonomous-orch-pipeline .gitignore package.json .codex/AGENTS.md .codex-plugin/plugin.json tests/ci/autonomous-orch-pipeline.test.js
   rtk git status --short
   ```

5. Report the approval gates, review-limit behavior, memory fallback, test
   results, and any unavailable environment checks in the handoff. Do not
   create a commit unless the owner separately authorizes committing the
   existing dirty worktree.

## Acceptance Criteria

- `$ecc:autonomous-orch-pipeline` is packaged on both canonical and Codex
  skill surfaces and is explicit-only.
- It performs the full requested lifecycle after plan approval, with concrete
  evidence and resumable local state for one plan item.
- Plan and commit gates remain human-controlled; no push occurs automatically.
- Three failed review/remediation rounds cause a user-controlled, one-round
  extension decision rather than unbounded retries.
- Verification regressions, unsafe memory conditions, and manual-stage
  compatibility are handled exactly as specified in the design.
- All focused structural, catalog, and available repository checks pass with
  no unintended file changes.
