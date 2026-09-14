# Autonomous Pipeline State-Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rebuildable `.ecc/autonomous-state.json` index that makes
autonomous-run discovery deterministic while preserving each Markdown ledger as
the authoritative execution record.

**Architecture:** The skill writes evidence to
`.ecc/autonomous-runs/<run-id>.md` first, then derives a compact JSON index
entry from it. At startup the index only accelerates candidate discovery; the
pipeline validates it against the ledger and current repository context before
acting. Missing, malformed, stale, or conflicting index data is rebuilt from
ledgers and stops at `needs_user_approval`.

**Tech Stack:** Markdown skills, YAML metadata mirror, Node.js built-in
assertions, existing ECC skill validation and Markdown linting.

## Global Constraints

- Keep `.ecc/autonomous-runs/<run-id>.md` as the sole source of truth for
  evidence, approvals, findings, and transitions.
- Store only selection and checkpoint fields in `.ecc/autonomous-state.json`;
  never store transcripts, command output, Memory Vault bodies, credentials,
  private keys, or tokens.
- Git-ignore both runtime-state paths. Do not initialize a service, scheduler,
  or cross-machine synchronization mechanism.
- Never modify an external `.autorun/state.json`; it can only seed a normal
  local ledger and derived index entry.
- Preserve plan, review-extension, commit, and blocked-run approval gates.
- Keep `skills/` and `.agents/skills/` autonomous-pipeline files byte-for-byte
  identical.

---

### Task 1: Lock the state-index contract and runtime ignore rule

**Files:**

- Modify: `tests/ci/autonomous-orch-pipeline.test.js`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: canonical autonomous-pipeline `SKILL.md` and `.gitignore`.
- Produces: a structural regression test for the versioned index, ledger-first
  writes, validation, rebuild behavior, and privacy boundaries.

- [x] **Step 1: Extend the failing contract test**

  Add these exact entries to `REQUIRED_SKILL_PHRASES`:

  ```js
  '.ecc/autonomous-state.json',
  '"schemaVersion": 1',
  'ledger remains authoritative',
  'write the ledger first',
  'after every state transition that changes resume-selection fields',
  'derive the index entry from the ledger',
  'validate the selected index entry against its ledger',
  'rebuild the entire index from valid local ledgers',
  'set the affected run to `needs_user_approval`',
  'Never select by timestamp alone',
  'never stores raw transcripts, command output, Memory Vault bodies, credentials, private keys, or tokens',
  ```

  Replace the single ignore assertion with two assertions:

  ```js
  const ignoreRules = readUtf8(path.join(REPO_ROOT, '.gitignore'));
  assert.ok(ignoreRules.includes('/.ecc/autonomous-runs/'));
  assert.ok(ignoreRules.includes('/.ecc/autonomous-state.json'));
  ```

- [x] **Step 2: Run the contract test for RED evidence**

  Run:

  ```bash
  rtk node tests/ci/autonomous-orch-pipeline.test.js
  ```

  Expected: the lifecycle contract test fails because the state-index phrases
  and index ignore rule do not yet exist.

- [x] **Step 3: Add the index ignore rule**

  Add this adjacent to the existing run-ledger rule in `.gitignore`:

  ```gitignore
  /.ecc/autonomous-runs/
  /.ecc/autonomous-state.json
  ```

- [x] **Step 4: Re-run the test and retain the expected skill-contract failure**

  Run:

  ```bash
  rtk node tests/ci/autonomous-orch-pipeline.test.js
  ```

  Expected: it still fails only for a missing state-index skill phrase; the
  ignore assertions now pass.

### Task 2: Define ledger-first index lifecycle and recovery

**Files:**

- Modify: `skills/autonomous-orch-pipeline/SKILL.md`
- Modify: `.agents/skills/autonomous-orch-pipeline/SKILL.md`
- Test: `tests/ci/autonomous-orch-pipeline.test.js`

**Interfaces:**

- Consumes: the existing per-run ledger, resume compatibility fields, and
  read-only external autorun adoption.
- Produces: `.ecc/autonomous-state.json` entries whose fields are derived from
  a validated ledger and whose selected run is revalidated before continuation.

- [x] **Step 1: Add the state-index data contract to both mirrored skills**

  Directly after **Local Run Ledger**, add a **Local State Index** section with
  this exact schema and the non-secret restriction:

  ```json
  {
    "schemaVersion": 1,
    "updatedAt": "<ISO-8601 timestamp>",
    "runs": {
      "<run-id>": {
        "ledgerPath": ".ecc/autonomous-runs/<run-id>.md",
        "status": "<run state>",
        "currentStage": "<pipeline stage>",
        "lastCompletedCheckpoint": "<checkpoint or null>",
        "nextAction": "<bounded action>",
        "plan": { "path": "<relative path>", "itemId": "<item ID>", "fingerprint": "<hash>" },
        "context": { "repositoryIdentity": "<id>", "worktreePath": "<path>", "branch": "<branch>", "baselineCommit": "<commit>" },
        "updatedAt": "<ISO-8601 timestamp>"
      }
    }
  }
  ```

  State directly that the ledger remains authoritative and the index never
  stores raw transcripts, command output, Memory Vault bodies, credentials,
  private keys, or tokens.

- [x] **Step 2: Add write ordering and startup validation**

  In the resume/checkpoint protocol, add these rules:

  ```text
  On creation and after every state transition that changes resume-selection
  fields (`status`, `currentStage`, `lastCompletedCheckpoint`, or `nextAction`),
  write the ledger first. This includes before starting a lifecycle stage and
  after evidence confirms a checkpoint. After every such ledger write, derive
  the index entry from the ledger, validate the complete JSON document, then
  replace .ecc/autonomous-state.json as one complete document.

  On startup, use the index only to list candidates. Validate the selected
  index entry against its referenced ledger and the existing repository,
  worktree, branch, plan-fingerprint, and baseline-commit checks before any
  continuation.
  ```

- [x] **Step 3: Add deterministic recovery behavior**

  Add this recovery rule:

  ```text
  If the index is missing, malformed, references a missing ledger, or differs
  from ledger-derived selection fields, rebuild the entire index from valid
  local ledgers. Set the affected run to `needs_user_approval`, report the
  mismatch and rebuilt index, and stop. Never select by timestamp alone or
  overwrite ledger evidence.
  ```

  Require user selection when validation leaves multiple compatible runs.

- [x] **Step 4: Integrate external autorun adoption**

  Extend **External Structured State** so that after a uniquely matched,
  accepted external item is adopted, the pipeline creates the normal Markdown
  ledger first and then derives the local index entry. Retain the existing rule
  that `.autorun/state.json` is never modified.

- [x] **Step 5: Keep mirrors identical and verify GREEN**

  Run:

  ```bash
  rtk node tests/ci/autonomous-orch-pipeline.test.js
  rtk cmp -s skills/autonomous-orch-pipeline/SKILL.md .agents/skills/autonomous-orch-pipeline/SKILL.md
  rtk cmp -s skills/autonomous-orch-pipeline/agents/openai.yaml .agents/skills/autonomous-orch-pipeline/agents/openai.yaml
  ```

  Expected: the contract test reports 5 passing assertions and both `cmp`
  commands exit successfully.

### Task 3: Publish the index behavior in the ECC handoff material

**Files:**

- Modify: `.codex/AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-13-autonomous-orch-pipeline-design.md`
- Modify: `docs/superpowers/plans/2026-09-13-autonomous-orch-pipeline.md`
- Create: `docs/superpowers/plans/2026-09-13-autonomous-pipeline-state-index.md`

**Interfaces:**

- Consumes: the approved state-index design and completed skill contract.
- Produces: discoverable operator guidance that differentiates the JSON index
  from the authoritative ledger and explains safe recovery.

- [x] **Step 1: Document operator-facing behavior**

  Add an **Autonomous Workflow** paragraph in `.codex/AGENTS.md` that says the
  JSON index selects candidate runs, the Markdown ledger supplies evidence,
  and a conflict rebuilds the index then stops for approval.

- [x] **Step 2: Reconcile design and original implementation plan**

  In the original autonomous-pipeline design and plan, add the approved index
  path, versioned schema, ledger-first ordering, conflict recovery, and
  external-autorun seeding rule. Link to
  `docs/superpowers/specs/2026-09-13-autonomous-pipeline-state-index-design.md`
  as the detailed source of truth.

- [x] **Step 3: Run delivery validation**

  Run:

  ```bash
  rtk node tests/ci/autonomous-orch-pipeline.test.js
  rtk node tests/ci/codex-core-workflow-skills.test.js
  rtk node tests/ci/codex-skill-surface.test.js
  rtk node scripts/ci/validate-skills.js --strict
  rtk npm run lint
  rtk git diff --check
  ```

  Expected: every command exits successfully; the structural test retains its
  five passing assertions, manual stages remain explicit-only, and canonical
  skill validation/linting find no errors.

- [ ] **Step 4: Review scope and commit only with explicit approval**

  Review:

  ```bash
  rtk git diff -- .gitignore skills/autonomous-orch-pipeline .agents/skills/autonomous-orch-pipeline .codex/AGENTS.md docs/superpowers tests/ci/autonomous-orch-pipeline.test.js
  rtk git status --short
  ```

  Do not stage, commit, push, or modify runtime state without explicit user
  approval. If approved, use:

  ```bash
  git add .gitignore skills/autonomous-orch-pipeline .agents/skills/autonomous-orch-pipeline .codex/AGENTS.md docs/superpowers tests/ci/autonomous-orch-pipeline.test.js
  git commit -m "feat(workflow): add autonomous state index"
  ```

## Spec-Coverage Self-Review

- Index schema, runtime paths, and privacy boundaries: Task 2, Step 1.
- Ledger-first writes and index validation: Task 2, Step 2.
- Rebuild-and-stop mismatch behavior and multi-run safety: Task 2, Step 3.
- Read-only external autorun seeding: Task 2, Step 4.
- Git-ignore rule, regression lock, mirror parity, documentation, and delivery
  checks: Tasks 1–3.

The plan contains no unresolved implementation choices: Markdown ledgers remain
authoritative, and the JSON index is a versioned rebuildable cache.
