# Local Codex Plugin Launcher Design

## Purpose

Provide one repository-local command that refreshes the active ECC Codex plugin
from the checked-out version and verifies the resulting cached plugin contents.

## Interface

The new executable will be `scripts/codex/install-local-plugin.sh` and will be
run with:

```bash
bash scripts/codex/install-local-plugin.sh
```

It accepts no arguments.

## Behaviour

The script derives the ECC repository root from its own location rather than
the caller's current directory. It runs these commands in order:

1. Best-effort `codex plugin remove ecc@ecc`
2. Best-effort `codex plugin marketplace remove ecc`
3. `codex plugin marketplace add <repository-root>`
4. `codex plugin add ecc@ecc`
5. `node <repository-root>/scripts/codex/check-plugin-cache.js`

The two removal steps make repeated local development runs reload the source
instead of relying on an existing cache. They are allowed to fail so a first
run, with no prior ECC registration, continues. The add, install, and cache
verification steps use Bash strict mode and stop on failure. The launcher
changes only Codex's normal ECC registration and cache; it does not invoke the
deprecated legacy sync workflow or edit repository files.

## Error Handling

Before the install sequence, the script verifies that `codex` and `node` are
available on `PATH`. Missing prerequisites and failures from the add, install,
or cache verification steps produce a non-zero exit status and a clear error
message. Failed removal steps are reported and treated as an absent prior
registration.

## Testing

A focused Node test will run the Bash script with fake `codex` and `node`
executables. It will verify the refresh/install command order, the resolved
repository root, first-run cleanup tolerance, and fail-fast behaviour after
cleanup. The test does not modify the caller's real Codex configuration or
plugin cache.

## Out of Scope

- Installing the marketplace release instead of the local checkout.
- The legacy `sync-ecc-to-codex.sh` path.
