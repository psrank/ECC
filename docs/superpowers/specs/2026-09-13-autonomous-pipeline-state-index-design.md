# Autonomous Pipeline State-Index Design

## Purpose

Add a small, Git-ignored JSON index alongside the autonomous pipeline's
per-run Markdown ledgers. The index makes discovery of active and paused runs
fast and deterministic across sessions, while the ledger remains the complete,
authoritative evidence record.

## Scope

- Add `.ecc/autonomous-state.json` as a local state index.
- Keep `.ecc/autonomous-runs/<run-id>.md` as the sole authoritative record of
  stage evidence, transitions, findings, and approvals.
- Define index creation, update, validation, rebuilding, and recovery rules in
  `$ecc:autonomous-orch-pipeline` and its Codex mirror.
- Extend the existing structural contract test, documentation, and Git-ignore
  rules.

## Non-Goals

- Do not replace the Markdown ledger with JSON.
- Do not commit either runtime-state path, create a background process, or
  synchronize state between machines.
- Do not modify an external `.autorun/state.json`; it remains a read-only
  checkpoint source that may seed a new local ledger and index entry.
- Do not use the index to bypass plan, review-extension, commit, or blocked-run
  approval gates.

## Index Format

The index lives at `.ecc/autonomous-state.json` and has a versioned, compact
shape:

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
      "plan": {
        "path": "<relative plan path>",
        "itemId": "<item ID>",
        "fingerprint": "<plan fingerprint>"
      },
      "context": {
        "repositoryIdentity": "<non-secret identifier>",
        "worktreePath": "<canonical path>",
        "branch": "<branch>",
        "baselineCommit": "<commit>"
      },
      "updatedAt": "<ISO-8601 timestamp>"
    }
  }
}
```

The index stores only resume-selection fields. It contains no raw transcripts,
command output, review bodies, Memory Vault content, credentials, or tokens.

## Lifecycle and Recovery

1. When a run is created or resumed, write its authoritative ledger first.
2. After each completed checkpoint or state transition, derive that run's index
   entry from the ledger and write a complete replacement JSON document.
3. On startup, read the index to list eligible active or paused runs, then
   validate the selected entry against its ledger and current repository,
   worktree, branch, plan fingerprint, and baseline-commit rules.
4. A valid matching index can speed discovery, but stage evidence is always
   read from the ledger before the pipeline continues.
5. If the index is absent, malformed, points to a missing ledger, or disagrees
   with ledger-derived selection fields, rebuild the entire index from valid
   local ledgers. Set the affected run to `needs_user_approval`, report the
   mismatch and rebuilt result, and do not continue engineering work in that
   invocation.
6. If more than one compatible run remains after validation, list candidates
   and request a selection. Never select by timestamp alone.

The index is a rebuildable cache, not a second source of truth. A ledger/index
disagreement never causes ledger evidence to be overwritten or discarded.

## External Autorun Integration

When an eligible `.autorun/state.json` identifies a uniquely matched accepted
plan item, the pipeline creates its normal Markdown ledger first, records the
external state fingerprint and native stage, and then derives the standard
index entry. The external file is never written. Its mapped stage—for example,
native `apply` to `implement (autorun apply)`—is verified through the new
ledger rather than treated as independent ECC state.

## Validation

The structural test must require:

- both state paths and their Git-ignore entries;
- `schemaVersion`, run-to-ledger linkage, stage/checkpoint/next-action fields,
  and non-secret boundaries;
- ledger-first updates and complete-document index replacement;
- index validation before continuation;
- deterministic rebuild plus `needs_user_approval` on any discrepancy;
- multi-run selection rather than timestamp guessing; and
- external autorun adoption writing the normal ledger/index pair without
  modifying `.autorun/state.json`.
