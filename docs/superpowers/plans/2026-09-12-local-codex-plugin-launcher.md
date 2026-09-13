# Local Codex Plugin Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe Bash launcher that refreshes the current ECC checkout as a Codex plugin and verifies its cache.

**Architecture:** A focused Bash script resolves the repository root from its own path, removes a prior ECC registration and marketplace on a best-effort basis, then performs the local install/cache verification sequence. A Node test runs the launcher against fake `codex` and `node` binaries, so it proves behavior without changing real Codex state.

**Tech Stack:** Bash, Node.js built-in modules, the repository's Node test runner.

## Global Constraints

- The launcher is `scripts/codex/install-local-plugin.sh` and accepts no arguments.
- Resolve the ECC root from the script path; never rely on the caller's working directory.
- Attempt `codex plugin remove ecc@ecc` and `codex plugin marketplace remove ecc` before installation; a removal failure is non-fatal to preserve first-run behavior.
- Invoke `codex plugin marketplace add <root>`, `codex plugin add ecc@ecc`, and `node <root>/scripts/codex/check-plugin-cache.js`, in that order after cleanup.
- Use Bash strict mode and do not run later add, install, or verification commands after a failure.
- Do not invoke the deprecated `sync-ecc-to-codex.sh` workflow.
- Tests must not change the caller's Codex configuration or plugin cache.

---

### Task 1: Add and test the local Codex plugin launcher

**Files:**
- Create: `scripts/codex/install-local-plugin.sh`
- Create: `tests/scripts/install-local-codex-plugin.test.js`

**Interfaces:**
- Consumes: `codex` and `node` executables available on `PATH`; the existing `scripts/codex/check-plugin-cache.js` verifier.
- Produces: an executable launcher invoked as `bash scripts/codex/install-local-plugin.sh`, returning zero only when all three required commands succeed.

- [ ] **Step 1: Write the failing behavior test**

Create `tests/scripts/install-local-codex-plugin.test.js`. Use Node's `assert`, `fs`, `os`, `path`, and `child_process` modules. Create a temporary `bin` directory containing executable fake `codex` and `node` shell scripts that append their received arguments to `ECC_TEST_CALLS`.

The success test must execute the launcher from a temporary working directory with the fake bin directory prepended to `PATH`, then assert this exact recorded order:

```javascript
assert.deepStrictEqual(readCalls(callsPath), [
  'codex plugin remove ecc@ecc',
  'codex plugin marketplace remove ecc',
  `codex plugin marketplace add ${repoRoot}`,
  'codex plugin add ecc@ecc',
  `node ${path.join(repoRoot, 'scripts', 'codex', 'check-plugin-cache.js')}`,
]);
```

Add a first-run test whose fake removal commands exit non-zero and assert that the add, install, and cache verification calls still run. Preserve existing tests that prove failures from marketplace add, plugin add, and cache verification stop later calls.

- [ ] **Step 2: Run the new test to establish the red state**

Run:

```bash
node tests/scripts/install-local-codex-plugin.test.js
```

Expected: FAIL because `scripts/codex/install-local-plugin.sh` does not exist.

- [ ] **Step 3: Implement the minimal Bash launcher**

Create `scripts/codex/install-local-plugin.sh` with this behavior:

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[ecc-codex-local-plugin] ERROR: %s is required but was not found on PATH\n' "$1" >&2
    exit 127
  fi
}

if [[ "$#" -ne 0 ]]; then
  printf 'Usage: %s\n' "$(basename "$0")" >&2
  exit 64
fi

require_command codex
require_command node

printf '[ecc-codex-local-plugin] Removing cached ecc@ecc registration when present\n'
codex plugin remove ecc@ecc || printf '[ecc-codex-local-plugin] No existing ecc@ecc registration removed; continuing\n' >&2
printf '[ecc-codex-local-plugin] Removing ecc marketplace when present\n'
codex plugin marketplace remove ecc || printf '[ecc-codex-local-plugin] No existing ecc marketplace removed; continuing\n' >&2
printf '[ecc-codex-local-plugin] Adding marketplace: %s\n' "$REPO_ROOT"
codex plugin marketplace add "$REPO_ROOT"
printf '[ecc-codex-local-plugin] Installing ecc@ecc\n'
codex plugin add ecc@ecc
printf '[ecc-codex-local-plugin] Verifying plugin cache\n'
node "$REPO_ROOT/scripts/codex/check-plugin-cache.js"
```

Mark the file executable.

- [ ] **Step 4: Run the focused test to establish the green state**

Run:

```bash
node tests/scripts/install-local-codex-plugin.test.js
```

Expected: Both the success-order and failure-stop tests pass.

- [ ] **Step 5: Run targeted quality checks**

Run:

```bash
npm run lint
npm test
```

Expected: Lint completes without errors, and the test suite completes with the new test passing.

- [ ] **Step 6: Verify coverage**

Run:

```bash
npm run coverage
```

Expected: The repository coverage gate meets its configured minimums: 80% lines, functions, and statements, and 79% branches.

- [ ] **Step 7: Review the diff and commit the coherent change**

Run:

```bash
git diff --check
git diff -- scripts/codex/install-local-plugin.sh tests/scripts/install-local-codex-plugin.test.js
git add scripts/codex/install-local-plugin.sh tests/scripts/install-local-codex-plugin.test.js
git commit -m "feat(codex): add local plugin launcher"
```

Expected: No whitespace errors; commit only after verifying that the two files are the intended change.
