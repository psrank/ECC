# Autonomous Orchestrator Pipeline Design

## Purpose

Add an explicitly invoked ECC workflow that can drive one approved plan item
through its engineering lifecycle without requiring the operator to manually
start each intermediate stage:

```text
plan -> test -> implement -> review -> verify -> remember -> improve
```

The workflow is autonomous only after an explicit invocation and plan
approval. It is an in-session, harness-directed workflow with a durable local
run ledger; it is not a background daemon, scheduler, or a replacement for
human approval of consequential actions.

## Scope

- Add a new canonical `autonomous-orch-pipeline` skill and its Codex skill
  mirror, exposed as `$ecc:autonomous-orch-pipeline`.
- Build it on the shared `orch-pipeline` conventions: size classification,
  task-list decomposition, TDD, security-review triggers, and review handoffs.
- Persist a resumable per-item run ledger under
  `.ecc/autonomous-runs/<run-id>.md`; ignore those local execution records in
  Git.
- Maintain a Git-ignored, versioned `.ecc/autonomous-state.json` index derived
  from local ledgers to make active and paused run discovery deterministic.
- Automatically run the test, implementation, review, verification, memory,
  and improvement phases after the plan gate, subject to the guards below.
- Add package-surface, install-manifest, and structural tests for the new
  skill and its run contract.

## Non-Goals

- Do not modify the seven explicit-only manual skills or their
  `allow_implicit_invocation: false` policy.
- Do not extend the external `ccg-workflow`-dependent `/workflow` command.
- Do not create a background scheduler, launch unattended operating-system
  processes, push branches, open pull requests, or publish externally.
- Do not automatically edit ECC skills, commands, rules, or other workflow
  artifacts during the improvement phase.
- Do not use the Memory Vault as a task tracker or store transcripts, secrets,
  credentials, or sensitive data.

## Public Interface

The new skill accepts a plan reference and one item selector, for example:

```text
$ecc:autonomous-orch-pipeline @docs/superpowers/plans/example.md#task-2
```

It also accepts a plain request when no plan exists. In that case it performs
the intake and plan work first, writes a task list, and stops at the plan gate.
Only an approved item may enter the autonomous portion of the workflow.

The skill is explicit-only. A legacy command shim is out of scope for the
first release because `skills/` is ECC's canonical workflow surface.

## Run Ledger and State Index

Each invocation creates or resumes a Markdown ledger with a stable run ID.
The ledger records only the minimum safe execution state:

- source plan, item ID, objective, acceptance criteria, and scope boundary;
- repository identity, canonical worktree path, branch, plan fingerprint, and
  baseline commit;
- active stage, last completed checkpoint, recorded next action, and prior
  transitions with timestamps;
- test, review, and verification commands plus pass/fail evidence;
- review-round count, unresolved findings, and escalation reason;
- memory ID or explicit `memory-pending` reason;
- improvement proposal and terminal outcome.

The ledger must not contain raw transcripts, secrets, credentials, or copied
Memory Vault bodies. It is a local resume aid, not an authoritative project
decision record.

The Git-ignored `.ecc/autonomous-state.json` is a compact `schemaVersion: 1`
candidate index, not a second evidence record. It includes only each run's
ledger path, status, current stage, last completed checkpoint, next action,
plan identity/fingerprint, context identity, and timestamp. The Markdown
ledger remains authoritative for all evidence, approvals, findings, and
transitions. The index never stores transcripts, command output, Memory Vault
bodies, credentials, private keys, or tokens. The detailed schema and recovery
rules live in [the state-index design](2026-09-13-autonomous-pipeline-state-index-design.md).

On creation and after every completed checkpoint or state transition, the
pipeline writes the ledger first, derives the index entry from that ledger,
validates the complete JSON document, and replaces the index as one complete
document. On invocation it uses the index only to list candidates. Before
continuing, it validates the selected entry against its referenced ledger and
the recorded repository, canonical worktree, branch, plan fingerprint, and
baseline commit.

If the index is missing, malformed, references a missing ledger, or differs
from ledger-derived selection fields, the pipeline rebuilds the entire index
from valid local ledgers, sets the affected run to `needs_user_approval`,
reports the mismatch and rebuilt result, and stops. It never selects by
timestamp alone, overwrites ledger evidence, or infers an owned in-progress
run from plan files, a dirty worktree, a branch name, or conversation context.
With multiple compatible candidates after validation, it asks the operator to
choose. A missing or mismatched ownership field stops the run for a new plan
approval or an explicit new run. `needs_user_approval` is paused/resumable,
not a completed outcome, so the next session surfaces its decision rather than
starting a different run.

When no autonomous ledger exists, a repository-local `.autorun/state.json`
with a declared stage order and item-stage status may serve as a read-only
structured checkpoint source. It selects exactly one started pending or
in-progress item with exactly one accepted plan-item match, excludes
skipped/completed items, and maps its first non-completed native stage to the
pipeline: notably, `apply` maps to `implement (autorun apply)`, while
pre-code `branch`, `propose`, `review`, and `gitignore` map to `plan-gate`.
The run report preserves both labels. This source never bypasses plan approval,
is never modified, and conflicts with a local ledger stop for user direction.
After a uniquely matched, accepted external item is adopted, the pipeline
creates the normal Markdown ledger first, records the external fingerprint and
native stage there, and then derives its local state-index entry.

When a ledger is incomplete or was created by an earlier version of the
workflow, the pipeline resolves and reports an explicit current stage from
ordered durable evidence before executing. A plan approval with no focused RED
evidence is `test`; RED without later GREEN is `implement`; GREEN without a
fresh clean review is `review` only when there is no unresolved blocking
finding; a blocking review finding without later GREEN takes precedence and is
`implement (review remediation)`; clean review without complete verification
is `verify`; then come `commit-gate`, `remember`, and `improve`.
Missing or contradictory evidence produces `needs_user_approval` and an
unresolved-stage report; a found plan or dirty worktree alone never establishes
a stage.

## Lifecycle and Gates

```text
intake/plan --[operator approves]--> test -> implement -> review
                                          ^                |
                                          |-- findings ----|
review --[clean]--> verify --[pass]--> commit gate --> remember --> improve
                           |                                  |
                           +-- targeted repair/re-review -------+
```

1. **Plan gate.** Present the item, acceptance criteria, scope, risks, and
   stop conditions. Do not alter production code until the user approves.
2. **TDD loop.** Write focused RED evidence, then make the smallest change to
   GREEN. A pre-existing unrelated failure is recorded and escalated instead
   of being treated as RED evidence.
3. **Review loop.** Use a fresh reviewer context on each round. Blocking
   findings return to the narrow implementation task; the reviewer then runs
   again against the updated diff.
4. **Verification loop.** Use `verification-loop` for the repository-native
   build, type, lint, test, coverage, security, and diff evidence. A failure
   routes back to the responsible stage and requires review again when code
   changes.
5. **Commit gate.** After all verification passes, show the diff summary and
   proposed conventional commit. Commit only when the user explicitly
   approves; never push automatically.
6. **Remember.** Search the Memory Vault first and save a concise non-secret
   outcome and handoff only when its runtime is available. If it is unavailable
   or the safe save fails, record `memory-pending` and report it; do not
   initialize a vault or bypass its protections automatically.
7. **Improve.** Produce the smallest evidence-based improvement proposal and
   its validation method. It is report-only until a separate user approval
   authorizes a workflow-artifact edit.

## Bounded Recovery

- The default review limit is **three failed review/remediation rounds**.
  After the third failed round, set the ledger state to
  `needs_user_approval`, summarize open findings and prior fixes, and ask
  whether to authorize exactly one additional round. Never raise the limit
  silently.
- If the same verification failure recurs without measurable progress across
  two repair checkpoints, freeze the run and request direction rather than
  retrying it.
- Ambiguous acceptance criteria, a security-sensitive action that requires
  external authority, missing prerequisites, dirty-worktree ambiguity, or a
  failed approval gate also transition to `needs_user_approval`.
- A declined approval, failed required verification, or unresolved review
  finding cannot produce a completed result.

## Completion Semantics

An item is `completed` only when its acceptance criteria, targeted TDD
evidence, clean review, and required verification evidence are present, and
the user has approved any requested commit. The final report distinguishes
completed outcomes from paused resumable states:

- `completed` — memory was saved or was intentionally unnecessary;
- `completed-with-memory-pending` — engineering evidence is complete but the
  optional Memory Vault runtime was unavailable or rejected the safe save;
- `needs_user_approval` — an approval or bounded-loop escalation is pending;
- `blocked` — the workflow cannot safely proceed without an external change
  or a revised plan. Both are resumable only after the recorded gate or
  prerequisite is satisfied and compatibility is rechecked.

## Compatibility and Reuse

- Reuse `orch-pipeline` for its task sizing, agent map, TDD discipline, and
  security-review criteria rather than duplicating those rules.
- Reuse `verification-loop` for readiness checks and `unified-memory` for
  Vault trust boundaries.
- Preserve the manual `plan`, `test`, `implement`, `review`, `verify`,
  `remember`, and `improve` skills as independently invoked stages. The new
  skill implements its own explicit orchestration and must not claim that the
  manual stages auto-run.
- Use the existing canonical `skills/` plus `.agents/skills/` mirror and
  `agents/openai.yaml` metadata pattern. Add the canonical directory to the
  npm package and `agentic-patterns` install-module manifests.

## Validation

The implementation will be test-first. Focused structural tests will verify
the two skill surfaces, explicit-only invocation metadata, lifecycle order,
all gates, review-limit escalation, completion states, manual-stage
compatibility, package inclusion, and the ignored run-ledger location. Existing
manual-core and Codex-surface tests must continue to pass.
The state-index contract adds schema, ledger-first derivation, selected-entry
validation, deterministic rebuild, and read-only external-autorun seeding
coverage.
