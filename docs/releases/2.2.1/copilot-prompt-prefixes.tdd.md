# Copilot Prompt Prefixes — TDD Evidence

Date: 2026-09-14

Source plan: the user requested that GitHub Copilot prompt commands use the
`ecc-` prefix. No external plan file was used.

## User journey

As an ECC user in GitHub Copilot Chat, I can invoke the bundled workflows with
the namespaced commands `/ecc-plan`, `/ecc-tdd`, `/ecc-security-review`,
`/ecc-build-fix`, and `/ecc-refactor`.

## RED evidence

`node tests/docs/copilot-support.test.js` failed after the test contract was
updated to require the five `ecc-*.prompt.md` files and prefixed command names:

```text
Failed: 2
```

The failures identified the previous unprefixed prompt filenames and stale
Copilot documentation.

## GREEN evidence

```text
node tests/docs/copilot-support.test.js
Passed: 5

npm run lint
PASS (exit code 0)
```

## Test specification

| Guarantee | Test | Type | Result |
|---|---|---|---|
| Copilot exposes exactly the five `ecc-`-prefixed prompt filenames | `tests/docs/copilot-support.test.js` | repository contract | PASS |
| Every prompt uses supported Copilot frontmatter | `tests/docs/copilot-support.test.js` | repository contract | PASS |
| English Copilot documentation advertises each prefixed slash command | `tests/docs/copilot-support.test.js` | documentation contract | PASS |
| JavaScript and Markdown lint remain green | `npm run lint` | static analysis | PASS |
| Full repository validation | `npm test`; `node tests/run-all.js` | integration | BLOCKED in sandbox |

## Known gaps

- Prompt-file command discovery was not exercised in a live VS Code session.
  The change is limited to the documented GitHub Copilot filename convention.
- The full test suite could not complete in this sandbox. Its child test
  processes fail with `spawnSync node EPERM`, and one test cannot bind
  `127.0.0.1` (`listen EPERM`). Coverage could not be measured under the same
  restriction.

## Merge evidence

No checkpoint commits were created; the user requested the working-tree change
but did not request commits. This report preserves the RED/GREEN evidence.
